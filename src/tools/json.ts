import yaml from 'js-yaml'
import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'
import { flattenJson, unflattenJson, analyzeStructure, lintJson } from './json-utils'

function tryParseJson(input: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: JSON.parse(input) }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export const jsonTool: ToolDescriptor = {
  id: 'json',
  name: 'JSON Tools',
  icon: '{ }',
  category: 'json',
  description: t('tools.json.description'),
  features: [
    { label: 'Validate', description: t('tools.json.features.Validate.description'), example: '{"a":1} → Valid JSON' },
    { label: 'Pretty print', description: t('tools.json.features.Pretty print.description'), example: '{"a":1} → {\\n  "a": 1\\n}' },
    { label: 'Minify', description: t('tools.json.features.Minify.description'), example: '{ "a" : 1 } → {"a":1}' },
    { label: 'Flatten', description: t('tools.json.features.Flatten.description'), example: '{"a":{"b":1}} → {"a.b":1}' },
    { label: 'Unflatten', description: t('tools.json.features.Unflatten.description'), example: '{"a.b":1} → {"a":{"b":1}}' },
    { label: 'JSON → YAML', description: t('tools.json.features.JSON → YAML.description'), example: '{"a":1} → a: 1' },
    { label: 'YAML → JSON', description: t('tools.json.features.YAML → JSON.description'), example: 'a: 1 → {"a":1}' },
    { label: 'Structure', description: t('tools.json.features.Structure.description'), example: 'Shows keys, types, nesting depth' },
    { label: 'JSON escape', description: t('tools.json.features.JSON escape.description'), example: 'he"llo → "he\\"llo"' },
    { label: 'JSON unescape', description: t('tools.json.features.JSON unescape.description'), example: '"he\\"llo" → he"llo' },
    { label: 'Lint', description: t('tools.json.features.Lint.description'), example: 'Shows errors with position and context' },
    { label: 'JSON tree', description: t('tools.json.features.JSON tree.description'), example: 'Interactive tree' },
  ],
  transform: (input: string) => {
    if (!input.trim()) return []

    const trimmed = input.trim()
    const parsed = tryParseJson(trimmed)
    const isJson = parsed.ok

    const validateResult = isJson
      ? t('jsonTools.valid')
      : t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSON')

    const prettyResult = isJson
      ? JSON.stringify(parsed.data, null, 2)
      : t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSON')

    const minifyResult = isJson
      ? JSON.stringify(parsed.data)
      : t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSON')

    const flattenResult = isJson && typeof parsed.data === 'object' && parsed.data !== null
      ? JSON.stringify(flattenJson(parsed.data), null, 2)
      : t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSON')

    const unflattenResult = isJson && typeof parsed.data === 'object' && parsed.data !== null && !Array.isArray(parsed.data)
      ? JSON.stringify(unflattenJson(parsed.data as Record<string, unknown>), null, 2)
      : t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSON')

    const jsonToYamlResult = isJson
      ? yaml.dump(parsed.data, { indent: 2, lineWidth: -1 })
      : t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSON')

    const yamlToJsonResult = (() => {
      try {
        return JSON.stringify(yaml.load(trimmed), null, 2)
      } catch {
        return t('jsonTools.errorPrefix') + t('jsonTools.error.invalidYAML')
      }
    })()

    const structureResult = isJson && typeof parsed.data === 'object' && parsed.data !== null
      ? analyzeStructure(parsed.data).report
      : t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSON')

    const jsonEscapeResult = (() => {
      try {
        return JSON.stringify(input)
      } catch {
        return t('jsonTools.errorPrefix') + t('jsonTools.error.escapeFailed')
      }
    })()

    const jsonUnescapeResult = (() => {
      try {
        const unescaped = JSON.parse(input)
        return typeof unescaped === 'string' ? unescaped : JSON.stringify(unescaped, null, 2)
      } catch {
        return t('jsonTools.errorPrefix') + t('jsonTools.error.invalidJSONString')
      }
    })()

    const lintResult = lintJson(trimmed)

    return [
      { label: 'Validate', value: validateResult },
      { label: 'Pretty print', value: prettyResult },
      { label: 'Minify', value: minifyResult },
      { label: 'Flatten', value: flattenResult },
      { label: 'Unflatten', value: unflattenResult },
      { label: 'JSON → YAML', value: jsonToYamlResult },
      { label: 'YAML → JSON', value: yamlToJsonResult },
      { label: 'Structure', value: structureResult },
      { label: 'JSON escape', value: jsonEscapeResult },
      { label: 'JSON unescape', value: jsonUnescapeResult },
      { label: 'Lint', value: lintResult },
      ...(isJson
        ? [{ label: 'JSON tree' as const, value: '', isTree: true as const, treeKey: 'json' as const, treeData: parsed.data }]
        : []),
    ]
  },
  relevance: {
    json: { tool: 1.0, transforms: { 'Pretty print': 2.0, 'Minify': 1.5, 'Validate': 1.5 } },
    yaml: { tool: 0.8, transforms: { 'YAML → JSON': 2.0 } },
  },
}
