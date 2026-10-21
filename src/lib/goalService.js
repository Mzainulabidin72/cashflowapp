/**
 * Penyimpanan Financial Goals.
 *
 * Goal disimpan di localStorage perangkat ini (belum ada tabel database untuk goal), dengan
 * kunci yang SAMA seperti versi sebelumnya (`lanila-goals-<userId>`) sehingga goal lama tetap
 * terbaca. Catatan: karena lokal, goal tidak ikut berpindah antar perangkat.
 */

const key = (userId) => `lanila-goals-${userId}`

export function newGoalId() {
  return `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
}

/** Baca & rapikan: buang entri rusak, pastikan id unik, angka valid; field lain dipertahankan. */
export function loadGoals(userId) {
  if (!userId) return []
  let raw
  try {
    raw = JSON.parse(localStorage.getItem(key(userId)) || '[]')
  } catch (_) {
    return []
  }
  if (!Array.isArray(raw)) return []
  const seen = new Set()
  const out = []
  for (const g of raw) {
    if (!g || typeof g !== 'object') continue
    let id = g.id != null && String(g.id) ? String(g.id) : newGoalId()
    if (seen.has(id)) id = newGoalId()
    seen.add(id)
    const n = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0)
    out.push({
      ...g,
      id,
      name: String(g.name ?? '').trim().slice(0, 60) || 'Tujuan tanpa nama',
      target: Math.max(0, n(g.target)),
      current: Math.max(0, n(g.current)),
      monthly: Math.max(0, n(g.monthly)),
      targetDate: typeof g.targetDate === 'string' && /^\d{4}-\d{2}-\d{2}/.test(g.targetDate) ? g.targetDate.slice(0, 10) : null,
      status: g.status || 'active',
    })
  }
  return out
}

/** Hasil: objek dengan ok (boolean) dan error (teks, bila gagal). */
export function saveGoals(userId, goals) {
  if (!userId) return { ok: false, error: 'Sesi login tidak ditemukan.' }
  try {
    localStorage.setItem(key(userId), JSON.stringify(goals))
    return { ok: true }
  } catch (e) {
    return { ok: false, error: 'Penyimpanan di perangkat penuh atau diblokir browser.' }
  }
}
