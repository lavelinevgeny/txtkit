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

    let yamlToJsonResult = ''
    try {
      const yamlParsed = yaml.load(trimmed)
      yamlToJsonResult = JSON.stringify(yamlParsed, null, 2)
    } catch {
      yamlToJsonResult = 'Error: invalid YAML'
    }

    const structureResult = isJson && typeof parsed.data === 'object' && parsed.data !== null
      ? analyzeStructure(parsed.data).report
      : 'Error: invalid JSON'

    let jsonEscapeResult = ''
    try {
      jsonEscapeResult = JSON.stringify(input)
    } catch {
      jsonEscapeResult = 'Error: escape failed'
    }

    let jsonUnescapeResult = ''
    try {
      const unescaped = JSON.parse(input)
      jsonUnescapeResult = typeof unescaped === 'string' ? unescaped : JSON.stringify(unescaped, null, 2)
    } catch {
      jsonUnescapeResult = 'Error: invalid JSON string'
    }

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
