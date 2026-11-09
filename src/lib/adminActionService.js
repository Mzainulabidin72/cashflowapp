import { supabase } from './supabase'

export async function performSuperAdminAction(action, payload) {
  const { data, error } = await supabase.functions.invoke('super-admin-action', {
    body: { action, payload },
  })
  if (error) {
    let responseError
    try {
      responseError = await error.context?.json?.()
    } catch (parseError) {
      console.warn('Could not read the administrative action error response:', parseError)
    }
    const detail = data?.error || responseError?.error || error.message
    throw new Error(detail || 'Aksi admin gagal.')
  }
  if (data?.error) throw new Error(data.error)
  return data
}
