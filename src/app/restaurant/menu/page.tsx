import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getUserContext, createClient } from '@/utils/supabase/server'

export const metadata = { title: 'Menu' }

export default async function MenuPage() {
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('menu_categories')
    .select(`
      id, name, sort_order, is_active,
      menu_items (
        id, name, price, is_available,
        recipes ( id, recipe_items ( count ) )
      )
    `)
    .eq('restaurant_id', ctx.restaurantId)
    .order('sort_order', { ascending: true })

  const cats = categories ?? []
  const totalItems = cats.reduce((s: number, c: any) => s + (c.menu_items?.length ?? 0), 0)

  return (
    <div className="ra-page">
      <div className="ra-page-header">
        <div>
          <h1>Menu &amp; Recipes</h1>
          <p style={{ color: '#64748b', fontSize: '0.875rem', fontWeight: 500 }}>
            {cats.length} categories · {totalItems} items · Link recipes to auto-deduct inventory
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <Link href="/restaurant/menu/categories/new" className="btn-ghost">+ Category</Link>
          <Link href="/restaurant/menu/items/new" className="btn-primary">+ Item</Link>
        </div>
      </div>

      {cats.length === 0 ? (
        <div className="ra-section" style={{ textAlign: 'center', padding: '3rem' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
          <h2 style={{ marginBottom: '0.5rem' }}>No menu yet</h2>
          <p style={{ color: '#64748b', marginBottom: '1.5rem' }}>Start by creating your first menu category</p>
          <Link href="/restaurant/menu/categories/new" className="btn-primary">Create First Category →</Link>
        </div>
      ) : (
        cats.map((cat: any) => (
          <div key={cat.id} className="ra-section" style={{ marginBottom: '1.25rem' }}>
            <div className="ra-section-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <h2 style={{ fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>{cat.name}</h2>
                <span className={`badge ${cat.is_active ? 'badge-green' : 'badge-red'}`}>{cat.is_active ? 'Active' : 'Hidden'}</span>
                <span className="badge badge-blue">{cat.menu_items?.length ?? 0} items</span>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <Link href={`/restaurant/menu/categories/${cat.id}/edit`} className="btn-ghost-sm">Edit Category</Link>
                <Link href={`/restaurant/menu/items/new?category=${cat.id}`} className="btn-ghost-sm">+ Item</Link>
              </div>
            </div>

            {(cat.menu_items ?? []).length > 0 ? (
              <table className="sa-table">
                <thead>
                  <tr>
                    <th>Item</th>
                    <th>Price</th>
                    <th>Status</th>
                    <th>Recipe (Stock Deduction)</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {cat.menu_items.map((item: any) => {
                    const recipes = Array.isArray(item.recipes) ? item.recipes[0] : item.recipes
                    const ingCount = recipes?.recipe_items ? (Array.isArray(recipes.recipe_items) ? recipes.recipe_items.length : (recipes.recipe_items as any)[0]?.count ?? 0) : 0
                    const hasRecipe = !!recipes

                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 600, color: '#0f172a' }}>{item.name}</td>
                        <td style={{ color: '#334155', fontWeight: 500 }}>₹{(Number(item.price) / 100).toFixed(2)}</td>
                        <td>
                          <span className={`badge ${item.is_available ? 'badge-green' : 'badge-red'}`}>
                            {item.is_available ? 'Available' : 'Unavailable'}
                          </span>
                        </td>
                        <td>
                          <Link
                            href={`/restaurant/menu/items/${item.id}/recipe`}
                            style={{
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '0.4rem',
                              padding: '0.25rem 0.6rem',
                              borderRadius: '0.4rem',
                              fontSize: '0.78rem',
                              fontWeight: 600,
                              textDecoration: 'none',
                              background: hasRecipe ? '#dcfce7' : '#fef3c7',
                              border: hasRecipe ? '1px solid #bbf7d0' : '1px solid #fde68a',
                              color: hasRecipe ? '#15803d' : '#b45309',
                            }}
                          >
                            🥣 {hasRecipe ? 'Recipe Active' : '+ Set Ingredients'}
                          </Link>
                        </td>
                        <td style={{ display: 'flex', gap: '0.6rem' }}>
                          <Link href={`/restaurant/menu/items/${item.id}/recipe`} className="link-action" style={{ color: '#7c3aed' }}>
                            Recipe
                          </Link>
                          <Link href={`/restaurant/menu/items/${item.id}/edit`} className="link-action">
                            Edit
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#64748b', fontSize: '0.875rem', padding: '0.75rem 0' }}>No items in this category yet.</p>
            )}
          </div>
        ))
      )}
    </div>
  )
}
