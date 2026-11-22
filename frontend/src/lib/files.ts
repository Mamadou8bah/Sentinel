export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result
      if (typeof result !== 'string') {
        reject(new Error('Could not read file'))
        return
      }
      const comma = result.indexOf(',')
      resolve(comma >= 0 ? result.slice(comma + 1) : result)
    }
    reader.onerror = () => reject(reader.error ?? new Error('File read failed'))
    reader.readAsDataURL(file)
  })
}

export function pct(score: number | null | undefined) {
  if (score == null || Number.isNaN(score)) return '—'
  return `${Math.round(score * 100)}%`
}

/** Keep phone-camera documents within the inference pixel budget without cropping. */
export async function prepareDocumentPhoto(file: File): Promise<File> {
  const url = URL.createObjectURL(file)
  try {
    const image = new Image()
    image.src = url
    await image.decode()
    if (image.naturalWidth <= 2400 && image.naturalHeight <= 2400) return file
    const scale = 2400 / Math.max(image.naturalWidth, image.naturalHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(image.naturalWidth * scale)
    canvas.height = Math.round(image.naturalHeight * scale)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Photo processing is unavailable')
    context.fillStyle = '#fff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob(value => value ? resolve(value) : reject(new Error('Photo processing failed')), 'image/jpeg', 0.92))
    return new File([blob], 'document.jpg', { type: 'image/jpeg' })
  } finally { URL.revokeObjectURL(url) }
}
