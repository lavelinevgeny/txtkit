import yaml from 'js-yaml'
import type { ToolDescriptor } from '../types/tool'
import { flattenJson, unflattenJson, analyzeStructure } from './json-utils'

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
  description: 'Format, validate, flatten, YAML convert, tree view',
  features: [
    { label: 'Validate', description: 'Check if the input is valid JSON and report errors', example: '{"a":1} → Valid JSON' },
    { label: 'Pretty print', description: 'Format JSON with 2-space indentation', example: '{"a":1} → {\\n  "a": 1\\n}' },
    { label: 'Minify', description: 'Remove all whitespace to produce compact JSON', example: '{ "a" : 1 } → {"a":1}' },
    { label: 'Flatten', description: 'Convert nested objects to dot-notation keys', example: '{"a":{"b":1}} → {"a.b":1}' },
    { label: 'Unflatten', description: 'Expand dot-notation keys back to nested objects', example: '{"a.b":1} → {"a":{"b":1}}' },
    { label: 'JSON → YAML', description: 'Convert JSON to YAML format', example: '{"a":1} → a: 1' },
    { label: 'YAML → JSON', description: 'Convert YAML to JSON format', example: 'a: 1 → {"a":1}' },
    { label: 'Structure', description: 'Analyze and display the JSON structure/schema', example: 'Shows keys, types, nesting depth' },
    { label: 'JSON escape', description: 'Escape a string for embedding as a JSON value', example: 'he"llo → "he\\"llo"' },
    { label: 'JSON unescape', description: 'Unescape a JSON string back to plain text', example: '"he\\"llo" → he"llo' },
  ],
  transform: (input: string) => {
    if (!input.trim()) return []

    const trimmed = input.trim()
    const parsed = tryParseJson(trimmed)
    const isJson = parsed.ok

    const validateResult = isJson
      ? 'Valid JSON'
      : `Error: ${parsed.error}`

    const prettyResult = isJson
      ? JSON.stringify(parsed.data, null, 2)
      : 'Error: invalid JSON'

    const minifyResult = isJson
      ? JSON.stringify(parsed.data)
      : 'Error: invalid JSON'

    const flattenResult = isJson && typeof parsed.data === 'object' && parsed.data !== null
      ? JSON.stringify(flattenJson(parsed.data), null, 2)
      : 'Error: invalid JSON'

    const unflattenResult = isJson && typeof parsed.data === 'object' && parsed.data !== null && !Array.isArray(parsed.data)
      ? JSON.stringify(unflattenJson(parsed.data as Record<string, unknown>), null, 2)
      : 'Error: invalid JSON'

    const jsonToYamlResult = isJson
      ? yaml.dump(parsed.data, { indent: 2, lineWidth: -1 })
      : 'Error: invalid JSON'

    const yamlToJsonResult = (() => {
      try {
        return JSON.stringify(yaml.load(trimmed), null, 2)
      } catch {
        return 'Error: invalid YAML'
      }
    })()

    const structureResult = isJson && typeof parsed.data === 'object' && parsed.data !== null
      ? analyzeStructure(parsed.data).report
      : 'Error: invalid JSON'

    const jsonEscapeResult = (() => {
      try {
        return JSON.stringify(input)
      } catch {
        return 'Error: escape failed'
      }
    })()

    const jsonUnescapeResult = (() => {
      try {
        const unescaped = JSON.parse(input)
        return typeof unescaped === 'string' ? unescaped : JSON.stringify(unescaped, null, 2)
      } catch {
        return 'Error: invalid JSON string'
      }
    })()

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
    ]
  },
}
