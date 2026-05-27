import type { ToolDescriptor } from '../types/tool'

export const encodeTool: ToolDescriptor = {
  id: 'encode',
  name: 'Encoders',
  icon: '{ }',
  category: 'encoding',
  description: 'Base64, URL encode/decode, HTML escape',
  transform: (input: string) => {
    if (!input.trim()) return []

    const base64Decode = (() => {
      try { return atob(input.trim()) } catch { return 'Error: invalid Base64' }
    })()

    const base64Encode = (() => {
      try { return btoa(unescape(encodeURIComponent(input))) } catch { return 'Error: encoding failed' }
    })()

    return [
      { label: 'Base64 encode', value: base64Encode },
      { label: 'Base64 decode', value: base64Decode },
      { label: 'URL encode', value: encodeURIComponent(input) },
      { label: 'URL decode', value: (() => { try { return decodeURIComponent(input) } catch { return 'Error: invalid URL encoding' } })() },
      { label: 'HTML escape', value: input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') },
      { label: 'HTML unescape', value: input.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') },
      { label: 'Escape quotes (""', value: `"${input.replace(/"/g, '""')}"` },
      { label: 'Unescape quotes (""', value: (() => { const t = input.trim(); return t.startsWith('"') && t.endsWith('"') ? t.slice(1, -1).replace(/""/g, '"') : 'Error: not wrapped in quotes' })() },
    ]
  },
}
