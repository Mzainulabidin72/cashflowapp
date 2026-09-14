import { supabase } from './supabase'

const KEY = 'payment_account'

const DEFAULT = {
  bank_name: '',
  account_number: '',
  account_name: '',
  notes: '',
}

export async function getPaymentAccount() {
  const { data, error } = await supabase
    .from('system_settings')
    .select('value')
    .eq('key', KEY)
    .maybeSingle()

  if (error) throw error
  return { ...DEFAULT, ...(data?.value || {}) }
}

export async function setPaymentAccount(value) {
  const { error } = await supabase.from('system_settings').upsert({
    key: KEY,
    value: {
      bank_name: value.bank_name || '',
      account_number: value.account_number || '',
      account_name: value.account_name || '',
      notes: value.notes || '',
    },
    updated_at: new Date().toISOString(),
  })
  if (error) throw error
}
