'use server'

import { createClient as createAdminClient } from '@supabase/supabase-js'
import { getUserContext, createClient } from '@/utils/supabase/server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

function getAdminClient() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// BRANCH ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createBranchAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const name = (formData.get('name') as string)?.trim()
  const city = (formData.get('city') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null

  if (!name) throw new Error('Branch name is required')

  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || `branch-${Date.now()}`

  const admin = getAdminClient()
  const { data: branch, error } = await admin
    .from('branches')
    .insert({
      restaurant_id: ctx.restaurantId,
      name,
      slug: `${slug}-${Math.random().toString(36).substring(2, 6)}`,
      city,
      address,
      phone,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/branches')
  revalidatePath('/restaurant/dashboard')
  redirect('/restaurant/branches')
}

export async function updateBranchAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const branchId = formData.get('branch_id') as string
  const name = (formData.get('name') as string)?.trim()
  const city = (formData.get('city') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null
  const phone = (formData.get('phone') as string)?.trim() || null
  const isActive = formData.get('is_active') === 'true'

  if (!branchId || !name) throw new Error('Branch ID and name are required')

  const admin = getAdminClient()
  const { error } = await admin
    .from('branches')
    .update({
      name,
      city,
      address,
      phone,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', branchId)
    .eq('restaurant_id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/branches')
  revalidatePath(`/restaurant/branches/${branchId}`)
  revalidatePath('/restaurant/dashboard')
  redirect('/restaurant/branches')
}

// ─────────────────────────────────────────────────────────────────────────────
// MENU ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createMenuCategoryAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const sortOrder = Number(formData.get('sort_order') ?? 0)

  if (!name) throw new Error('Category name is required')

  const admin = getAdminClient()
  const { error } = await admin.from('menu_categories').insert({
    restaurant_id: ctx.restaurantId,
    name,
    description,
    sort_order: isNaN(sortOrder) ? 0 : sortOrder,
    is_active: true,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/menu')
  redirect('/restaurant/menu')
}

export async function updateMenuCategoryAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const categoryId = formData.get('category_id') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const sortOrder = Number(formData.get('sort_order') ?? 0)
  const isActive = formData.get('is_active') === 'true'

  if (!categoryId || !name) throw new Error('Category ID and name are required')

  const admin = getAdminClient()
  const { error } = await admin
    .from('menu_categories')
    .update({
      name,
      description,
      sort_order: isNaN(sortOrder) ? 0 : sortOrder,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    })
    .eq('id', categoryId)
    .eq('restaurant_id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/menu')
  redirect('/restaurant/menu')
}

export async function deleteMenuCategoryAction(categoryId: string) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()
  const { error } = await admin
    .from('menu_categories')
    .delete()
    .eq('id', categoryId)
    .eq('restaurant_id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/menu')
}

export async function createMenuItemAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const name = (formData.get('name') as string)?.trim()
  const categoryId = formData.get('category_id') as string
  const priceRupees = Number(formData.get('price') ?? 0)
  const description = (formData.get('description') as string)?.trim() || null
  const isAvailable = formData.get('is_available') !== 'false'
  const branchIds = formData.getAll('branch_ids') as string[]

  if (!name || !categoryId) throw new Error('Name and category are required')
  if (isNaN(priceRupees) || priceRupees < 0) throw new Error('Valid price is required')

  const admin = getAdminClient()
  const { data: item, error } = await admin
    .from('menu_items')
    .insert({
      restaurant_id: ctx.restaurantId,
      category_id: categoryId,
      name,
      description,
      price: Math.round(priceRupees * 100), // convert to paise
      is_available: isAvailable,
      is_active: true,
    })
    .select('id')
    .single()

  if (error) throw new Error(error.message)

  // Branch menu assignments
  const { data: allBranches } = await admin
    .from('branches')
    .select('id')
    .eq('restaurant_id', ctx.restaurantId)

  if (allBranches && allBranches.length > 0) {
    if (branchIds.length > 0) {
      const branchRows = allBranches.map(b => ({
        branch_id: b.id,
        menu_item_id: item.id,
        is_available: branchIds.includes(b.id),
      }))
      await admin.from('branch_menu_items').upsert(branchRows, { onConflict: 'branch_id,menu_item_id' })
    }
  }

  revalidatePath('/restaurant/menu')
  revalidatePath('/staff/pos')
  redirect('/restaurant/menu')
}

export async function updateMenuItemAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const itemId = formData.get('item_id') as string
  const name = (formData.get('name') as string)?.trim()
  const categoryId = formData.get('category_id') as string
  const priceRupees = Number(formData.get('price') ?? 0)
  const description = (formData.get('description') as string)?.trim() || null
  const isAvailable = formData.get('is_available') === 'true'
  const branchIds = formData.getAll('branch_ids') as string[]

  if (!itemId || !name || !categoryId) throw new Error('Item ID, name and category are required')

  const admin = getAdminClient()
  const { error } = await admin
    .from('menu_items')
    .update({
      name,
      category_id: categoryId,
      price: Math.round(priceRupees * 100),
      description,
      is_available: isAvailable,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('restaurant_id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  // Update branch assignments
  const { data: allBranches } = await admin
    .from('branches')
    .select('id')
    .eq('restaurant_id', ctx.restaurantId)

  if (allBranches && allBranches.length > 0) {
    if (branchIds.length > 0) {
      const branchRows = allBranches.map(b => ({
        branch_id: b.id,
        menu_item_id: itemId,
        is_available: branchIds.includes(b.id),
      }))
      await admin.from('branch_menu_items').upsert(branchRows, { onConflict: 'branch_id,menu_item_id' })
    } else {
      // If none explicitly checked, delete overrides so it remains default
      await admin.from('branch_menu_items').delete().eq('menu_item_id', itemId)
    }
  }

  revalidatePath('/restaurant/menu')
  revalidatePath('/staff/pos')
  redirect('/restaurant/menu')
}

export async function deleteMenuItemAction(itemId: string) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()
  const { error } = await admin
    .from('menu_items')
    .delete()
    .eq('id', itemId)
    .eq('restaurant_id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/menu')
  revalidatePath('/staff/pos')
}

// ─────────────────────────────────────────────────────────────────────────────
// ROLES & PERMISSIONS ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createRoleAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const permissions = formData.getAll('permissions') as string[]

  if (!name) throw new Error('Role name is required')

  const admin = getAdminClient()

  // 1. Insert role
  const { data: role, error: roleError } = await admin
    .from('roles')
    .insert({
      restaurant_id: ctx.restaurantId,
      name,
      description,
      is_default: false,
    })
    .select()
    .single()

  if (roleError) throw new Error(roleError.message)

  // 2. Insert role permissions
  if (permissions.length > 0) {
    const permRows = permissions.map(p => ({
      role_id: role.id,
      permission: p,
    }))
    const { error: permError } = await admin.from('role_permissions').insert(permRows)
    if (permError) throw new Error(permError.message)
  }

  revalidatePath('/restaurant/roles')
  redirect('/restaurant/roles')
}

export async function updateRoleAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const roleId = formData.get('role_id') as string
  const name = (formData.get('name') as string)?.trim()
  const description = (formData.get('description') as string)?.trim() || null
  const permissions = formData.getAll('permissions') as string[]

  if (!roleId || !name) throw new Error('Role ID and name are required')

  const admin = getAdminClient()

  // Update role info
  const { error: roleError } = await admin
    .from('roles')
    .update({ name, description, updated_at: new Date().toISOString() })
    .eq('id', roleId)
    .eq('restaurant_id', ctx.restaurantId)

  if (roleError) throw new Error(roleError.message)

  // Replace permissions
  await admin.from('role_permissions').delete().eq('role_id', roleId)
  if (permissions.length > 0) {
    const permRows = permissions.map(p => ({
      role_id: roleId,
      permission: p,
    }))
    await admin.from('role_permissions').insert(permRows)
  }

  revalidatePath('/restaurant/roles')
  redirect('/restaurant/roles')
}

export async function deleteRoleAction(roleId: string) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()
  const { error } = await admin
    .from('roles')
    .delete()
    .eq('id', roleId)
    .eq('restaurant_id', ctx.restaurantId)
    .eq('is_default', false)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/roles')
}

// ─────────────────────────────────────────────────────────────────────────────
// USER & STAFF ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function inviteStaffAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const email = (formData.get('email') as string)?.trim().toLowerCase()
  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const password = formData.get('password') as string
  const branchId = formData.get('branch_id') as string
  const roleId = formData.get('role_id') as string

  if (!email || !name || !password || !branchId || !roleId) {
    throw new Error('All required fields must be filled.')
  }
  if (password.length < 8) {
    throw new Error('Password must be at least 8 characters.')
  }

  const admin = getAdminClient()

  // 1. Create auth user
  const { data: authData, error: authError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { name },
  })

  if (authError) throw new Error(authError.message)
  const userId = authData.user!.id

  // 2. Ensure profile exists and has phone
  await admin.from('profiles').upsert({
    id: userId,
    name,
    phone,
    is_active: true,
    updated_at: new Date().toISOString(),
  })

  // 3. Insert branch_members
  const { error: bmError } = await admin.from('branch_members').insert({
    branch_id: branchId,
    user_id: userId,
    role_id: roleId,
    is_active: true,
  })

  if (bmError) {
    await admin.auth.admin.deleteUser(userId)
    throw new Error(bmError.message)
  }

  revalidatePath('/restaurant/users')
  redirect('/restaurant/users')
}

export async function updateStaffAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const userId = formData.get('user_id') as string
  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const branchId = formData.get('branch_id') as string
  const roleId = formData.get('role_id') as string
  const isActive = formData.get('is_active') === 'true'
  const newPassword = (formData.get('password') as string)?.trim()

  if (!userId || !name || !branchId || !roleId) {
    throw new Error('User ID, name, branch and role are required.')
  }

  const admin = getAdminClient()

  // 1. Update profile
  await admin.from('profiles').update({
    name,
    phone,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }).eq('id', userId)

  // 2. Update branch_members
  await admin.from('branch_members').update({
    branch_id: branchId,
    role_id: roleId,
    is_active: isActive,
  }).eq('user_id', userId)

  // 3. Optional password update
  if (newPassword && newPassword.length >= 8) {
    await admin.auth.admin.updateUserById(userId, { password: newPassword })
  }

  revalidatePath('/restaurant/users')
  redirect('/restaurant/users')
}

export async function toggleStaffStatusAction(userId: string, currentStatus: boolean) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()
  await admin.from('profiles').update({ is_active: !currentStatus }).eq('id', userId)
  await admin.from('branch_members').update({ is_active: !currentStatus }).eq('user_id', userId)

  revalidatePath('/restaurant/users')
}

// ─────────────────────────────────────────────────────────────────────────────
// RESTAURANT SETTINGS ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function updateRestaurantSettingsAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const name = (formData.get('name') as string)?.trim()
  const phone = (formData.get('phone') as string)?.trim() || null
  const email = (formData.get('email') as string)?.trim() || null
  const city = (formData.get('city') as string)?.trim() || null
  const address = (formData.get('address') as string)?.trim() || null

  if (!name) throw new Error('Restaurant name is required')

  const admin = getAdminClient()
  const { error } = await admin
    .from('restaurants')
    .update({
      name,
      phone,
      email,
      city,
      address,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/settings')
  revalidatePath('/restaurant/dashboard')
  redirect('/restaurant/settings')
}

// ─────────────────────────────────────────────────────────────────────────────
// INVENTORY ACTIONS
// ─────────────────────────────────────────────────────────────────────────────

export async function createInventoryItemAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const name = (formData.get('name') as string)?.trim()
  const unit = (formData.get('unit') as string)?.trim() || 'kg'
  const lowStockThreshold = Number(formData.get('low_stock_threshold') ?? 0)
  const description = (formData.get('description') as string)?.trim() || null
  const branchId = formData.get('branch_id') as string
  const openingQty = Number(formData.get('opening_qty') ?? 0)
  const openingDate = (formData.get('opening_date') as string)?.trim() || new Date().toISOString().slice(0, 10)

  if (!name) throw new Error('Item name is required')

  const admin = getAdminClient()
  const { data: item, error } = await admin
    .from('inventory_items')
    .insert({
      restaurant_id: ctx.restaurantId,
      name,
      unit,
      low_stock_threshold: isNaN(lowStockThreshold) ? 0 : lowStockThreshold,
      description,
      is_active: true,
    })
    .select()
    .single()

  if (error) throw new Error(error.message)

  // If opening stock provided, record initial transaction with specified opening date
  if (branchId && openingQty > 0) {
    const createdAt = `${openingDate}T00:00:00.000Z`
    await admin.from('inventory_transactions').insert({
      inventory_item_id: item.id,
      branch_id: branchId,
      transaction_type: 'opening',
      quantity: openingQty,
      unit,
      notes: `Initial opening stock (${openingDate})`,
      created_by: ctx.userId,
      created_at: createdAt,
    })
  }

  revalidatePath('/restaurant/inventory')
  revalidatePath('/restaurant/inventory/audit')
  redirect('/restaurant/inventory')
}

export async function updateInventoryItemAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const itemId = formData.get('item_id') as string
  const name = (formData.get('name') as string)?.trim()
  const unit = (formData.get('unit') as string)?.trim() || 'kg'
  const lowStockThreshold = Number(formData.get('low_stock_threshold') ?? 0)
  const description = (formData.get('description') as string)?.trim() || null

  if (!itemId || !name) throw new Error('Item ID and name are required')

  const admin = getAdminClient()
  const { error } = await admin
    .from('inventory_items')
    .update({
      name,
      unit,
      low_stock_threshold: isNaN(lowStockThreshold) ? 0 : lowStockThreshold,
      description,
      updated_at: new Date().toISOString(),
    })
    .eq('id', itemId)
    .eq('restaurant_id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/inventory')
  redirect('/restaurant/inventory')
}

export async function deleteInventoryItemAction(itemId: string) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const admin = getAdminClient()
  const { error } = await admin
    .from('inventory_items')
    .delete()
    .eq('id', itemId)
    .eq('restaurant_id', ctx.restaurantId)

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/inventory')
}

export async function stockInAction(formData: FormData) {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) throw new Error('Unauthorized')

  const itemId = formData.get('inventory_item_id') as string
  const branchId = formData.get('branch_id') as string
  const quantity = Number(formData.get('quantity') ?? 0)
  const unit = (formData.get('unit') as string)?.trim() || 'kg'
  const supplier = (formData.get('supplier') as string)?.trim() || null
  const notes = (formData.get('notes') as string)?.trim() || null
  const transactionDate = (formData.get('transaction_date') as string)?.trim()

  if (!itemId || !branchId || quantity <= 0) {
    throw new Error('Item, branch and a positive quantity are required.')
  }

  // Calculate transaction timestamp for day-wise ledger
  let createdAt = new Date().toISOString()
  if (transactionDate) {
    const isToday = new Date().toISOString().slice(0, 10) === transactionDate
    if (!isToday) {
      createdAt = `${transactionDate}T12:00:00.000Z`
    }
  }

  const admin = getAdminClient()
  const { error } = await admin.from('inventory_transactions').insert({
    inventory_item_id: itemId,
    branch_id: branchId,
    transaction_type: 'purchase',
    quantity: Math.abs(quantity),
    unit,
    supplier,
    notes,
    created_by: ctx.userId,
    created_at: createdAt,
  })

  if (error) throw new Error(error.message)

  revalidatePath('/restaurant/inventory')
  revalidatePath('/restaurant/inventory/audit')
  redirect('/restaurant/inventory')
}
