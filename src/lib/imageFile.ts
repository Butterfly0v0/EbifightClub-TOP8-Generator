/** 读取并压缩图片为 data URL，避免撑爆 localStorage。 */
export function readImageFile(
  file: File,
  opts: { maxEdge?: number; quality?: number; mime?: string } = {},
): Promise<string> {
  const maxEdge = opts.maxEdge ?? 1920
  const quality = opts.quality ?? 0.86
  const mime = opts.mime ?? 'image/jpeg'

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('读取图片失败'))
    reader.onload = () => {
      const src = String(reader.result ?? '')
      const img = new Image()
      img.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(img.width, img.height))
        const w = Math.max(1, Math.round(img.width * scale))
        const h = Math.max(1, Math.round(img.height * scale))
        const canvas = document.createElement('canvas')
        canvas.width = w
        canvas.height = h
        const ctx = canvas.getContext('2d')
        if (!ctx) {
          reject(new Error('无法处理图片'))
          return
        }
        ctx.drawImage(img, 0, 0, w, h)
        try {
          resolve(canvas.toDataURL(mime, quality))
        } catch {
          resolve(src)
        }
      }
      img.onerror = () => reject(new Error('图片解码失败'))
      img.src = src
    }
    reader.readAsDataURL(file)
  })
}
