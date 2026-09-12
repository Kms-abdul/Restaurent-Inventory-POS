import { redirect } from 'next/navigation'

export default function CountRedirect() {
  redirect('/restaurant/inventory/audit')
}
