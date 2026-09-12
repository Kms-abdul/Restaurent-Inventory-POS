'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserContext } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export interface IngredientInput {
  inventory_item_id: string
  quantity: number
  unit: string
  notes?: string
}

export async function saveRecipeAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const menuItemId = formData.get('menu_item_id') as string
  const rawIngredients = formData.get('ingredients_json') as string

  if (!menuItemId) throw new Error('Menu Item ID is required')

  let ingredients: IngredientInput[] = []
  try {
    ingredients = JSON.parse(rawIngredients || '[]')
  } catch {
    throw new Error('Invalid ingredients data format')
  }

  const admin = getAdminClient()

  // 1. Find or create recipe header
  const { data: existingRecipe } = await admin
    .from('recipes')
    .select('id')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('menu_item_id', menuItemId)
    .maybeSingle()

  let recipeId = existingRecipe?.id

  if (!recipeId) {
    const { data: newRecipe, error: createError } = await admin
      .from('recipes')
      .insert({
        restaurant_id: ctx.restaurantId,
        menu_item_id: menuItemId,
        is_active: true,
      })
      .select('id')
      .single()

    if (createError) throw new Error(createError.message)
    recipeId = newRecipe.id
  } else {
    // Ensure active
    await admin.from('recipes').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', recipeId)
  }

  // 2. Delete existing recipe items
  await admin.from('recipe_items').delete().eq('recipe_id', recipeId)

  // 3. Insert new recipe items
  if (ingredients.length > 0) {
    const rows = ingredients
      .filter(i => i.inventory_item_id && Number(i.quantity) > 0)
      .map(i => ({
        recipe_id: recipeId,
        inventory_item_id: i.inventory_item_id,
        quantity: Number(i.quantity),
        unit: i.unit || 'unit',
        notes: i.notes || null,
      }))

    if (rows.length > 0) {
      const { error: insertItemsError } = await admin.from('recipe_items').insert(rows)
      if (insertItemsError) throw new Error(insertItemsError.message)
    }
  }

  revalidatePath('/restaurant/menu')
  revalidatePath(`/restaurant/menu/items/${menuItemId}/recipe`)
  redirect('/restaurant/menu')
}

export async function deleteRecipeAction(menuItemId: string) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()
  await admin
    .from('recipes')
    .delete()
    .eq('restaurant_id', ctx.restaurantId)
    .eq('menu_item_id', menuItemId)

  revalidatePath('/restaurant/menu')
  redirect('/restaurant/menu')
}
