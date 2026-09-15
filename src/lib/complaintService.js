import { supabase } from './supabase'

export async function listMyComplaints(userId) {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })

  if (error) throw error
  return data || []
}

export async function listAllComplaints() {
  const { data, error } = await supabase
    .from('complaints')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) throw error
  if (!data?.length) return []

  const userIds = [...new Set(data.map((c) => c.user_id).filter(Boolean))]
  let profileMap = {}
  if (userIds.length) {
    const { data: profiles, error: pe } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)
    if (pe) throw pe
    ;(profiles || []).forEach((p) => {
      profileMap[p.id] = p
    })
  }

  return data.map((c) => ({
    ...c,
    profile: profileMap[c.user_id] || null,
  }))
}

export async function createComplaint(userId, subject) {
  const text = String(subject || '').trim()
  if (!text) throw new Error('Subjek kosong')

  const { data, error } = await supabase
    .from('complaints')
    .insert({
      user_id: userId,
      subject: text,
      status: 'OPEN',
    })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function updateComplaintStatus(id, status) {
  const { error } = await supabase
    .from('complaints')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)

  if (error) throw error
}

export async function listComplaintMessages(complaintId) {
  const { data, error } = await supabase
    .from('complaint_messages')
    .select('*')
    .eq('complaint_id', complaintId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function sendComplaintMessage(complaintId, senderId, message) {
  const text = String(message || '').trim()
  if (!text) throw new Error('Pesan kosong')

  const { data, error } = await supabase
    .from('complaint_messages')
    .insert({
      complaint_id: complaintId,
      sender_id: senderId,
      message: text,
    })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Realtime pesan keluhan */
export function subscribeComplaintMessages(complaintId, onInsert) {
  const channel = supabase
    .channel(`complaint-messages-${complaintId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'complaint_messages',
        filter: `complaint_id=eq.${complaintId}`,
      },
      (payload) => {
        if (payload?.new && typeof onInsert === 'function') {
          onInsert(payload.new)
        }
      }
    )
    .subscribe()

  return () => {
    supabase.removeChannel(channel)
  }
}
