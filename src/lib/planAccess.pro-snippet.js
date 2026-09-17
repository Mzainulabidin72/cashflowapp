// Tambahkan ke planAccess.js yang sudah ada:

export function canUseProTools(planName) {
  const n = String(planName || '').toLowerCase()
  return n.includes('pro') || n.includes('tahun') || n.includes('annual')
}

// di getUserPlanInfo return, tambah:
// canUseProTools: canUseProTools(planName)
