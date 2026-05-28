import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'
import {
  validateBlocks,
  prettyPrint,
  minifyBlocks,
  blockStats,
  extractEmbeddedJSON,
  splitBlocks,
  blocksToJSON,
  parseBlocks,
  logFieldsList,
} from './1c-blocks-utils'

export const blocksTool: ToolDescriptor = {
  id: '1c-blocks',
  name: '1C Blocks',
  icon: '{ }',
  category: 'dev',
  description: t('tools.1c-blocks.description'),
  features: [
    { label: 'Validate', description: t('tools.1c-blocks.features.Validate.description'), example: '{1,2} → Valid' },
    { label: 'Pretty print', description: t('tools.1c-blocks.features.Pretty print.description'), example: '{1,{2}} → formatted' },
    { label: 'Block count', description: t('tools.1c-blocks.features.Block count.description'), example: 'Blocks, depth, values' },
    { label: 'To JSON', description: t('tools.1c-blocks.features.To JSON.description'), example: '{1,2} → {"children":[1,2]}' },
    { label: 'Extract JSON', description: t('tools.1c-blocks.features.Extract JSON.description'), example: 'Pulls out embedded JSON strings' },
    { label: 'Minify', description: t('tools.1c-blocks.features.Minify.description'), example: '{ 1 , 2 } → {1,2}' },
    { label: 'Split blocks', description: t('tools.1c-blocks.features.Split blocks.description'), example: '{1},{2} → separate blocks' },
    { label: '1C log tree', description: t('tools.1c-blocks.features.1C log tree.description'), example: 'Interactive tree' },
    { label: 'Log fields', description: t('tools.1c-blocks.features.Log fields.description'), example: 'Named field list' },
  ],
  detect: (input: string) => {
    const trimmed = input.trim()
    if (!trimmed.startsWith('{')) return null
    let braceCount = 0
    let inString = false
    for (let i = 0; i < trimmed.length; i++) {
      const ch = trimmed[i]
      if (ch === '"' && !inString) { inString = true; continue }
      if (ch === '"' && inString) {
        if (trimmed[i + 1] === '"') { i++; continue }
        inString = false; continue
      }
      if (inString) continue
      if (ch === '{') braceCount++
      if (ch === '}') braceCount--
      if (braceCount < 0) return null
    }
    if (braceCount !== 0) return null
    const hasNested = trimmed.indexOf('{', 1) !== -1 && trimmed.indexOf('{', 1) < trimmed.lastIndexOf('}')
    const commaCount = (trimmed.match(/,/g) || []).length
    if (commaCount < 2 && !hasNested) return null
    return { type: '1c-blocks', label: '1C Blocks', confidence: 0.85 }
  },
  transform: (input: string) => {
    if (!input.trim()) return []

    const validation = validateBlocks(input)

    const validateResult = validation.valid
      ? t('1cBlocks.valid')
      : t('1cBlocks.errorPrefix') + validation.errors.join('; ')

    const prettyResult = validation.valid
      ? prettyPrint(input)
      : t('1cBlocks.errorPrefix') + t('1cBlocks.error.invalidFormat')

    const stats = blockStats(input)
    const statsResult = [
      `Blocks: ${stats.totalBlocks} (top-level: ${stats.topLevelBlocks})`,
      `Depth: ${stats.maxDepth}`,
      `Values: ${stats.totalValues}`,
      `Strings: ${stats.stringCount}`,
      `Numbers: ${stats.numberCount}`,
      `Identifiers: ${stats.identifierCount}`,
    ].join('\n')

    const toJsonResult = validation.valid
      ? blocksToJSON(input)
      : t('1cBlocks.errorPrefix') + t('1cBlocks.error.invalidFormat')

    const extracted = extractEmbeddedJSON(input)
    const extractResult = extracted.length > 0
      ? extracted.join('\n\n---\n\n')
      : t('1cBlocks.noEmbeddedJSON')

    const minifyResult = validation.valid
      ? minifyBlocks(input)
      : t('1cBlocks.errorPrefix') + t('1cBlocks.error.invalidFormat')

    const parts = splitBlocks(input)
    const splitResult = parts.length > 1
      ? parts.map((p, i) => `--- Block ${i + 1} ---\n${p}`).join('\n\n')
      : t('1cBlocks.singleBlock')

    const { topLevel } = parseBlocks(input)
    const treeAst = topLevel

    const fieldNames = Array.from({ length: 19 }, (_, i) => t(`1cBlocks.field.${i}`))

    const logFieldsResult = validation.valid && topLevel.length > 0
      ? logFieldsList(input, fieldNames, t('1cBlocks.unknownField'), t('1cBlocks.lgfHeader'))
      : ''

    return [
      { label: 'Validate', value: validateResult },
      { label: 'Pretty print', value: prettyResult },
      { label: 'Block count', value: statsResult },
      { label: 'To JSON', value: toJsonResult },
      { label: 'Extract JSON', value: extractResult },
      { label: 'Minify', value: minifyResult },
      { label: 'Split blocks', value: splitResult },
      ...(validation.valid
        ? [{ label: '1C log tree' as const, value: '', isTree: true as const, treeKey: '1c-log-blocks' as const, treeData: treeAst }]
        : []),
      ...(logFieldsResult
        ? [{ label: 'Log fields' as const, value: logFieldsResult }]
        : []),
    ]
  },
  relevance: {
    '1c-blocks': { tool: 1.0 },
  },
  scope: {
    multiLine: true,
  },
}
