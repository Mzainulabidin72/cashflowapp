import { toPng } from 'html-to-image'

export async function exportElementAsPng(element, filename = 'bukukas-ringkasan.png') {
  if (!element) throw new Error('Elemen tidak ditemukan')

  const dataUrl = await toPng(element, {
    cacheBust: true,
    pixelRatio: 2,
    backgroundColor: '#16231F',
    filter: (node) => {
      if (node?.dataset?.exportIgnore === 'true') return false
      return true
    },
  })

  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
}
