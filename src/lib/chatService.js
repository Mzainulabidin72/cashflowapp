import { supabase } from './supabase'

export async function getOrCreateMyConversation(userId) {
  const { data: existing, error: e1 } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (e1) throw e1
  if (existing) return existing

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId, status: 'open' })
    .select()
    .single()

  if (error) throw error
  return data
}

export async function listConversations() {
  const { data: convs, error } = await supabase
    .from('chat_conversations')
    .select('id, user_id, admin_id, status, last_message_at, created_at')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  if (!convs?.length) return []

  const userIds = [...new Set(convs.map((c) => c.user_id).filter(Boolean))]

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

  return convs.map((c) => ({
    ...c,
    profiles: profileMap[c.user_id] || null,
  }))
}

export async function listMessages(conversationId) {
  const { data, error } = await supabase
    .from('chat_messages')
    .select('*')
    .eq('conversation_id', conversationId)
    .order('created_at', { ascending: true })

  if (error) throw error
  return data || []
}

export async function sendMessage(conversationId, senderId, message) {
  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message: message.trim(),
    })
    .select()
    .single()

  if (error) throw error

  await supabase
    .from('chat_conversations')
    .update({ last_message_at: new Date().toISOString() })
    .eq('id', conversationId)

  return data
}