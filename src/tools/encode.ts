import type { ToolDescriptor } from '../types/tool'

export const encodeTool: ToolDescriptor = {
  id: 'encode',
  name: 'Encoders',
  icon: '{ }',
  category: 'encoding',
  description: 'Base64, URL encode/decode, HTML escape, JSON escape',
  transform: (input: string) => {
    if (!input.trim()) return []

    let base64Decode = ''
    try {
      base64Decode = atob(input.trim())
    } catch {
      base64Decode = 'Error: invalid Base64'
    }

    let jsonUnescape = ''
    try {
      jsonUnescape = JSON.parse(input)
    } catch {
      jsonUnescape = 'Error: invalid JSON string'
    }

    let base64Encode = ''
    try {
      base64Encode = btoa(unescape(encodeURIComponent(input)))
    } catch {
      base64Encode = 'Error: encoding failed'
    }

    return [
      { label: 'Base64 encode', value: base64Encode },
      { label: 'Base64 decode', value: base64Decode },
      { label: 'URL encode', value: encodeURIComponent(input) },
      { label: 'URL decode', value: (() => { try { return decodeURIComponent(input) } catch { return 'Error: invalid URL encoding' } })() },
      { label: 'HTML escape', value: input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') },
      { label: 'HTML unescape', value: input.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') },
      { label: 'JSON escape', value: JSON.stringify(input) },
      { label: 'JSON unescape', value: jsonUnescape },
    ]
  },
}
