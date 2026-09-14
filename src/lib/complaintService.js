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
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, full_name, email')
      .in('id', userIds)

    if (pErr) throw pErr
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
  const { data, error } = await supabase
    .from('complaints')
    .insert({
      user_id: userId,
      subject: subject.trim(),
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
  const { data, error } = await supabase
    .from('complaint_messages')
    .insert({
      complaint_id: complaintId,
      sender_id: senderId,
      message: message.trim(),
      is_internal: false,
    })
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('complaints')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', complaintId)

  return data
}