import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'
import { htmlEscape, htmlUnescape, urlEncode, urlDecode } from '../utils/text-encode-ops'

export const encodeTool: ToolDescriptor = {
  id: 'encode',
  name: 'Encoders',
  icon: '⇄',
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
      try { return decodeURIComponent(escape(atob(input.trim()))) } catch { return t('encode.error.invalidBase64') }
    })()

    const base64Encode = (() => {
      try { return btoa(unescape(encodeURIComponent(input))) } catch { return t('encode.error.encodingFailed') }
    })()

    const urlEncodeSafe = (() => {
      try { return urlEncode(input) } catch { return t('encode.error.encodingFailed') }
    })()

    const urlDecodeSafe = (() => {
      try { return urlDecode(input) } catch { return t('encode.error.invalidUrl') }
    })()

    return [
      { label: 'Base64 encode', value: base64Encode },
      { label: 'Base64 decode', value: base64Decode },
      { label: 'URL encode', value: urlEncodeSafe },
      { label: 'URL decode', value: urlDecodeSafe },
      { label: 'HTML escape', value: htmlEscape(input) },
      { label: 'HTML unescape', value: htmlUnescape(input) },
      { label: 'Escape quotes (""', value: `"${input.replace(/"/g, '""')}"` },
      { label: 'Unescape quotes (""', value: (() => { const txt = input.trim(); return txt.startsWith('"') && txt.endsWith('"') ? txt.slice(1, -1).replace(/""/g, '"') : t('encode.error.notQuoted') })() },
    ]
  },
  relevance: {
    base64: { tool: 1.0, transforms: { 'Base64 decode': 2.0, 'Base64 encode': 0.5 } },
    'url-encoded': { tool: 1.0, transforms: { 'URL decode': 2.0, 'URL encode': 0.5 } },
    'html-entities': { tool: 0.9, transforms: { 'HTML unescape': 2.0, 'HTML escape': 0.5 } },
  },
}
