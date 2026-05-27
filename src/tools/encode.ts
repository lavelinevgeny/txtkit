import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/context'

export const encodeTool: ToolDescriptor = {
  id: 'encode',
  name: 'Encoders',
  icon: '{ }',
  category: 'encoding',
  description: t('tools.encode.description'),
  features: [
    { label: 'Base64 encode', description: t('tools.encode.features.Base64 encode.description'), example: 'hello → aGVsbG8=' },
    { label: 'Base64 decode', description: t('tools.encode.features.Base64 decode.description'), example: 'aGVsbG8= → hello' },
    { label: 'URL encode', description: t('tools.encode.features.URL encode.description'), example: 'a b → a%20b' },
    { label: 'URL decode', description: t('tools.encode.features.URL decode.description'), example: 'a%20b → a b' },
    { label: 'HTML escape', description: t('tools.encode.features.HTML escape.description'), example: '<div> → &lt;div&gt;' },
    { label: 'HTML unescape', description: t('tools.encode.features.HTML unescape.description'), example: '&lt; → <' },
    { label: 'Escape quotes', description: t('tools.encode.features.Escape quotes.description'), example: 'he"llo → "he""llo"' },
    { label: 'Unescape quotes', description: t('tools.encode.features.Unescape quotes.description'), example: '"he""llo" → he"llo' },
  ],
  transform: (input: string) => {
    if (!input.trim()) return []

    const base64Decode = (() => {
      try { return atob(input.trim()) } catch { return t('encode.error.invalidBase64') }
    })()

    const base64Encode = (() => {
      try { return btoa(unescape(encodeURIComponent(input))) } catch { return t('encode.error.encodingFailed') }
    })()

    return [
      { label: 'Base64 encode', value: base64Encode },
      { label: 'Base64 decode', value: base64Decode },
      { label: 'URL encode', value: encodeURIComponent(input) },
      { label: 'URL decode', value: (() => { try { return decodeURIComponent(input) } catch { return t('encode.error.invalidUrl') } })() },
      { label: 'HTML escape', value: input.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;') },
      { label: 'HTML unescape', value: input.replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&') },
      { label: 'Escape quotes (""', value: `"${input.replace(/"/g, '""')}"` },
      { label: 'Unescape quotes (""', value: (() => { const txt = input.trim(); return txt.startsWith('"') && txt.endsWith('"') ? txt.slice(1, -1).replace(/""/g, '"') : t('encode.error.notQuoted') })() },
    ]
  },
}
