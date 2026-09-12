import { redirect, notFound } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'
import RecipeEditor from '@/components/menu/RecipeEditor'

export const metadata = { title: 'Recipe & Ingredients' }

export default async function MenuItemRecipePage({ params }: { params: Promise<{ id: string }> }) {
  const { id: menuItemId } = await params
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()

  // 1. Fetch menu item
  const { data: menuItem } = await supabase
    .from('menu_items')
    .select('id, name, price, category_id')
    .eq('id', menuItemId)
    .eq('restaurant_id', ctx.restaurantId)
    .single()

  if (!menuItem) notFound()

  // 2. Fetch inventory items for this restaurant
  const { data: inventoryItems } = await supabase
    .from('inventory_items')
    .select('id, name, unit, low_stock_threshold')
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_active', true)
    .order('name')

  // 3. Fetch existing recipe and items if any
  const { data: recipe } = await supabase
    .from('recipes')
    .select(`
      id, notes,
      recipe_items ( inventory_item_id, quantity, unit, notes )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .eq('menu_item_id', menuItemId)
    .maybeSingle()

  const existingItems = recipe?.recipe_items ?? []

  return (
    <div className="ra-page" style={{ maxWidth: '850px' }}>
      <div className="ra-page-header">
        <div>
          <Link href="/restaurant/menu" style={{ color: '#2563eb', fontSize: '0.875rem', fontWeight: 600, textDecoration: 'none' }}>
            ← Back to Menu
          </Link>
          <h1 style={{ marginTop: '0.5rem', color: '#0f172a' }}>Recipe: {menuItem.name}</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>
            Price: ₹{(Number(menuItem.price) / 100).toFixed(2)} · Auto-deducts inventory when sold
          </p>
        </div>
      </div>

      <RecipeEditor
        menuItem={menuItem}
        inventoryItems={inventoryItems ?? []}
        existingRecipe={recipe ? { id: recipe.id, notes: recipe.notes } : null}
        existingItems={existingItems}
      />
    </div>
  )
}
