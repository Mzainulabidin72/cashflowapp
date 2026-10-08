/**
 * Pembaca .xlsx ringan, tanpa dependensi.
 *
 * .xlsx adalah file zip berisi XML. Di sini kita:
 *   1. membaca daftar file di dalam zip (central directory),
 *   2. membuka kompresi dengan DecompressionStream bawaan browser,
 *   3. mengambil teks sel dari sharedStrings + sheet, dan mengubah sel bertanggal
 *      (angka serial Excel) menjadi "YYYY-MM-DD".
 *
 * readXlsx(arrayBuffer) → [{ name, records: string[][], lines: number[] }]
 *   records[i] = isi sel satu baris, lines[i] = nomor baris asli di Excel.
 * Baris yang seluruh selnya kosong dilewati.
 *
 * Hanya membaca nilai tampilan sederhana; rumus dibaca dari hasil terakhir yang
 * tersimpan di file. Format .xls (Excel lama) dan .xlsb tidak didukung.
 */

const te = new TextDecoder('utf-8')
const MAX_ENTRY_BYTES = 40 * 1024 * 1024
const MAX_ROWS_PER_SHEET = 5000

function bad(msg) {
  return new Error(msg)
}

/* ------------------------------ zip ------------------------------ */

function listZipEntries(buf) {
  const len = buf.byteLength
  const dv = new DataView(buf)
  const bytes = new Uint8Array(buf)

  let eocd = -1
  const lowest = Math.max(0, len - 22 - 65535)
  for (let i = len - 22; i >= lowest; i--) {
    if (dv.getUint32(i, true) === 0x06054b50) {
      eocd = i
      break
    }
  }
  if (eocd < 0) {
    throw bad('File ini bukan .xlsx yang valid (struktur zip tidak ditemukan).')
  }

  const count = dv.getUint16(eocd + 10, true)
  const cdOffset = dv.getUint32(eocd + 16, true)
  if (count === 0xffff || cdOffset === 0xffffffff) {
    throw bad('File .xlsx terlalu besar atau memakai format zip64 yang belum didukung.')
  }

  const entries = new Map()
  let p = cdOffset
  for (let n = 0; n < count; n++) {
    if (p + 46 > len || dv.getUint32(p, true) !== 0x02014b50) {
      throw bad('File .xlsx rusak (daftar isi zip tidak terbaca).')
    }
    const flags = dv.getUint16(p + 8, true)
    const method = dv.getUint16(p + 10, true)
    const csize = dv.getUint32(p + 20, true)
    const usize = dv.getUint32(p + 24, true)
    const nlen = dv.getUint16(p + 28, true)
    const elen = dv.getUint16(p + 30, true)
    const clen = dv.getUint16(p + 32, true)
    const lho = dv.getUint32(p + 42, true)
    const name = te.decode(bytes.subarray(p + 46, p + 46 + nlen))
    entries.set(name, { flags, method, csize, usize, lho })
    p += 46 + nlen + elen + clen
  }
  return entries
}

async function inflateRaw(data) {
  if (typeof DecompressionStream === 'undefined') {
    throw bad(
      'Browser ini belum bisa membaca .xlsx. Simpan file sebagai CSV, atau perbarui browser.'
    )
  }
  const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readEntry(buf, entry) {
  if (entry.flags & 1) throw bad('File .xlsx diproteksi password dan tidak bisa dibaca.')
  if (entry.usize > MAX_ENTRY_BYTES) throw bad('Isi file .xlsx terlalu besar.')
  const dv = new DataView(buf)
  const lh = entry.lho
  if (lh + 30 > buf.byteLength || dv.getUint32(lh, true) !== 0x04034b50) {
    throw bad('File .xlsx rusak (data zip tidak terbaca).')
  }
  const start = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true)
  if (start + entry.csize > buf.byteLength) throw bad('File .xlsx rusak atau terpotong.')
  const data = new Uint8Array(buf, start, entry.csize)
  if (entry.method === 0) return data
  if (entry.method === 8) return inflateRaw(data)
  throw bad('Metode kompresi file .xlsx tidak didukung.')
}

/* ------------------------------ xml ------------------------------ */

function decodeXml(s) {
  return String(s)
    .replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (m, e) => {
      const l = e.toLowerCase()
      if (l === 'amp') return '&'
      if (l === 'lt') return '<'
      if (l === 'gt') return '>'
      if (l === 'quot') return '"'
      if (l === 'apos') return "'"
      const code = l[1] === 'x' ? parseInt(l.slice(2), 16) : parseInt(l.slice(1), 10)
      try {
        return String.fromCodePoint(code)
      } catch {
        return ''
      }
    })
    .replace(/_x([0-9A-Fa-f]{4})_/g, (m, h) => String.fromCharCode(parseInt(h, 16)))
}

function attrsOf(str) {
  const out = {}
  const re = /([\w:.-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  let m
  while ((m = re.exec(str))) out[m[1]] = decodeXml(m[2] ?? m[3] ?? '')
  return out
}

/** Gabungkan semua <t> di dalam potongan XML (mengabaikan teks fonetik <rPh>). */
function collectText(fragment) {
  const frag = fragment.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  const re = /<t\b[^>]*>([\s\S]*?)<\/t>/g
  let s = ''
  let m
  while ((m = re.exec(frag))) s += decodeXml(m[1])
  return s
}

function parseSharedStrings(xml) {
  const out = []
  if (!xml) return out
  const re = /<si\b[^>]*?(?:\/>|>([\s\S]*?)<\/si>)/g
  let m
  while ((m = re.exec(xml))) out.push(m[1] ? collectText(m[1]) : '')
  return out
}

/* ------------------------------ tanggal ------------------------------ */

const BUILTIN_DATE_IDS = new Set([
  14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36,
  45, 46, 47, 50, 51, 52, 53, 54, 55, 56, 57, 58,
])

function isDateFormatCode(code) {
  const c = String(code || '')
    .replace(/"[^"]*"/g, '')
    .replace(/\[[^\]]*\]/g, '')
    .replace(/\\./g, '')
    .replace(/_./g, '')
    .replace(/\*./g, '')
  return /[ymdhs]/i.test(c)
}

function parseDateStyles(xml) {
  const dateXfs = new Set()
  if (!xml) return dateXfs

  const custom = new Map()
  const fmtRe = /<numFmt\b([^>]*)\/?>/g
  let m
  while ((m = fmtRe.exec(xml))) {
    const a = attrsOf(m[1])
    if (a.numFmtId != null) custom.set(Number(a.numFmtId), a.formatCode || '')
  }

  const blk = xml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  if (!blk) return dateXfs
  const xfRe = /<xf\b([^>]*)>/g
  let idx = 0
  while ((m = xfRe.exec(blk[1]))) {
    const id = Number(attrsOf(m[1]).numFmtId || 0)
    const isDate = custom.has(id) ? isDateFormatCode(custom.get(id)) : BUILTIN_DATE_IDS.has(id)
    if (isDate) dateXfs.add(idx)
    idx++
  }
  return dateXfs
}

function serialToIso(n, date1904) {
  if (!(n >= 1)) return ''
  const base = date1904 ? Date.UTC(1904, 0, 1) : Date.UTC(1899, 11, 30)
  const d = new Date(base + Math.floor(n + 1e-9) * 86400000)
  const p2 = (x) => String(x).padStart(2, '0')
  return `${d.getUTCFullYear()}-${p2(d.getUTCMonth() + 1)}-${p2(d.getUTCDate())}`
}

/* ------------------------------ sheet ------------------------------ */

function colIndex(letters) {
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

function parseSheet(xml, shared, dateStyles, date1904) {
  const records = []
  const lines = []
  const rowRe = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
  let rm
  let prevRow = 0

  while ((rm = rowRe.exec(xml))) {
    const ra = attrsOf(rm[1])
    const rowNum = ra.r ? Number(ra.r) : prevRow + 1
    prevRow = rowNum
    if (!rm[2]) continue

    const cells = []
    const cellRe = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cm
    let nextCol = 0
    while ((cm = cellRe.exec(rm[2]))) {
      const ca = attrsOf(cm[1])
      let ci = nextCol
      if (ca.r) {
        const mm = ca.r.match(/^([A-Za-z]+)/)
        if (mm) ci = colIndex(mm[1])
      }
      nextCol = ci + 1
      if (!cm[2]) continue

      const inner = cm[2]
      const vm = inner.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)
      const raw = vm ? vm[1] : null
      let val = ''

      switch (ca.t) {
        case 's':
          val = raw != null ? shared[Number(raw)] ?? '' : ''
          break
        case 'inlineStr': {
          const im = inner.match(/<is\b[^>]*>([\s\S]*?)<\/is>/)
          val = im ? collectText(im[1]) : ''
          break
        }
        case 'str':
          val = raw != null ? decodeXml(raw) : ''
          break
        case 'b':
          val = raw === '1' ? 'TRUE' : 'FALSE'
          break
        case 'e':
          val = ''
          break
        case 'd':
          val = raw != null ? decodeXml(raw).slice(0, 10) : ''
          break
        default: {
          if (raw == null || raw === '') break
          const num = Number(raw)
          if (!Number.isFinite(num)) val = decodeXml(raw)
          else if (dateStyles.has(Number(ca.s))) val = serialToIso(num, date1904)
          // dibulatkan 2 desimal agar "1234.567" tidak terbaca sebagai ribuan
          else val = String(Math.round(num * 100) / 100)
        }
      }
      cells[ci] = val
    }

    if (!cells.some((v) => v != null && String(v).trim() !== '')) continue
    for (let i = 0; i < cells.length; i++) if (cells[i] == null) cells[i] = ''
    records.push(cells)
    lines.push(rowNum)
    if (records.length >= MAX_ROWS_PER_SHEET) break
  }
  return { records, lines }
}

/* ------------------------------ publik ------------------------------ */

export async function readXlsx(buf) {
  const entries = listZipEntries(buf)
  const readText = async (name) =>
    entries.has(name) ? te.decode(await readEntry(buf, entries.get(name))) : null

  const wbXml = await readText('xl/workbook.xml')
  if (!wbXml) {
    throw bad('File ini bukan workbook Excel (.xlsx) yang valid.')
  }
  const relsXml = (await readText('xl/_rels/workbook.xml.rels')) || ''
  const date1904 = /<workbookPr\b[^>]*date1904\s*=\s*"(?:1|true)"/i.test(wbXml)

  const rels = new Map()
  const relRe = /<Relationship\b([^>]*)\/?>/g
  let m
  while ((m = relRe.exec(relsXml))) {
    const a = attrsOf(m[1])
    if (a.Id && a.Target) rels.set(a.Id, a)
  }

  const sheetDefs = []
  const shRe = /<sheet\b([^>]*)\/?>/g
  while ((m = shRe.exec(wbXml))) {
    const a = attrsOf(m[1])
    if (a.state === 'hidden' || a.state === 'veryHidden') continue
    const rel = rels.get(a['r:id'])
    if (!rel || !/worksheet$/.test(rel.Type || '')) continue
    let target = rel.Target.replace(/^\/+/, '')
    if (!target.startsWith('xl/')) target = 'xl/' + target
    target = target.replace(/xl\/(?:\.\.\/)+/, '')
    if (!target.startsWith('xl/')) target = 'xl/' + target
    sheetDefs.push({ name: a.name || `Sheet${sheetDefs.length + 1}`, path: target })
  }
  if (!sheetDefs.length) throw bad('Tidak ada sheet yang bisa dibaca di file ini.')

  const shared = parseSharedStrings(await readText('xl/sharedStrings.xml'))
  const dateStyles = parseDateStyles(await readText('xl/styles.xml'))

  const sheets = []
  for (const def of sheetDefs) {
    const xml = await readText(def.path)
    if (!xml) continue
    const { records, lines } = parseSheet(xml, shared, dateStyles, date1904)
    if (records.length) sheets.push({ name: def.name, records, lines })
  }
  if (!sheets.length) throw bad('Semua sheet di file ini kosong.')
  return sheets
}
