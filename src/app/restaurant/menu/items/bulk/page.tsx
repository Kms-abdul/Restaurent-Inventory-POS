import { redirect } from 'next/navigation'
import { getUserContext, createClient } from '@/utils/supabase/server'
import BulkItemsForm from './BulkItemsForm'

export const metadata = { title: 'Bulk Add Menu Items' }

export default async function BulkItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>
}) {
  const { category } = await searchParams
  const ctx = await getUserContext()
  if (!ctx?.restaurantId) redirect('/')

  const supabase = await createClient()
  const { data: categories } = await supabase
    .from('menu_categories')
    .select('id, name')
    .eq('restaurant_id', ctx.restaurantId)
    .order('sort_order', { ascending: true })

  const catList = categories ?? []
  const defaultCategoryId = category ?? catList[0]?.id ?? ''

  return <BulkItemsForm categories={catList} defaultCategoryId={defaultCategoryId} />
}
