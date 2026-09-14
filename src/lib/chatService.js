import { supabase } from './supabase'

/** User: ambil / buat 1 percakapan milik sendiri */
export async function getOrCreateMyConversation(userId) {
  // Ambil 1 saja (kalau ada duplikat)
  const { data: rows, error: e1 } = await supabase
    .from('chat_conversations')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: true })
    .limit(1)

  if (e1) throw e1
  if (rows && rows.length > 0) return rows[0]

  const { data, error } = await supabase
    .from('chat_conversations')
    .insert({ user_id: userId })
    .select()
    .single()

  if (error) throw error
  return data
}

/** Admin: daftar percakapan + nama user */
export async function listConversations() {
  const { data: convs, error } = await supabase
    .from('chat_conversations')
    .select('*')
    .order('last_message_at', { ascending: false, nullsFirst: false })

  if (error) throw error
  if (!convs?.length) return []

  const userIds = [...new Set(convs.map((c) => c.user_id).filter(Boolean))]
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

  return convs.map((c) => ({
    ...c,
    profile: profileMap[c.user_id] || null,
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
  const text = String(message || '').trim()
  if (!text) throw new Error('Pesan kosong')

  const { data, error } = await supabase
    .from('chat_messages')
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      message: text,
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

/** Realtime: listen INSERT pesan di 1 percakapan */
export function subscribeMessages(conversationId, onInsert) {
  const channel = supabase
    .channel(`chat-messages-${conversationId}`)
    .on(
      'postgres_changes',
      {
        event: 'INSERT',
        schema: 'public',
        table: 'chat_messages',
        filter: `conversation_id=eq.${conversationId}`,
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
