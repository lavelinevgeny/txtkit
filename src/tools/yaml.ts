import yaml from 'js-yaml'
import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'
import { analyzeStructure } from './json-utils'

function tryParseYaml(input: string): { ok: true; data: unknown } | { ok: false; error: string } {
  try {
    return { ok: true, data: yaml.load(input) }
  } catch (error) {
    return { ok: false, error: formatYamlError(error) }
  }
}

function formatYamlError(error: unknown): string {
  const details: string[] = []

  if (error !== null && typeof error === 'object') {
    const yamlError = error as {
      reason?: unknown
      message?: unknown
      mark?: { line?: number; column?: number; snippet?: string }
    }

    if (typeof yamlError.reason === 'string' && yamlError.reason.trim()) {
      details.push(yamlError.reason)
    } else if (typeof yamlError.message === 'string' && yamlError.message.trim()) {
      details.push(yamlError.message)
    }

    if (yamlError.mark?.line !== undefined && yamlError.mark.column !== undefined) {
      details.push(t('yamlTools.location', {
        line: yamlError.mark.line + 1,
        column: yamlError.mark.column + 1,
      }))
    }

    if (yamlError.mark?.snippet) {
      details.push(yamlError.mark.snippet)
    }
  }

  return t('yamlTools.errorPrefix') + t('yamlTools.error.invalidYAML') + (details.length ? `\n${details.join('\n')}` : '')
}

function isStructured(data: unknown): data is Record<string, unknown> | unknown[] {
  return data !== null && typeof data === 'object'
}

function hasCircularReference(data: unknown, stack = new WeakSet<object>()): boolean {
  if (!isStructured(data)) return false

  if (stack.has(data)) return true
  stack.add(data)

  const values = Array.isArray(data) ? data : Object.values(data)
  for (const value of values) {
    if (hasCircularReference(value, stack)) return true
  }

  stack.delete(data)
  return false
}

export const yamlTool: ToolDescriptor = {
  id: 'yaml',
  name: 'YAML Tools',
  icon: 'Y:',
  category: 'yaml',
  description: t('tools.yaml.description'),
  features: [
    { label: 'Validate', description: t('tools.yaml.features.Validate.description'), example: 'name: test → Valid YAML' },
    { label: 'Pretty print', description: t('tools.yaml.features.Pretty print.description'), example: 'name:test → name: test' },
    { label: 'YAML → JSON', description: t('tools.yaml.features.YAML → JSON.description'), example: 'name: test → {"name":"test"}' },
    { label: 'Structure', description: t('tools.yaml.features.Structure.description'), example: 'Shows keys, types, nesting depth' },
    { label: 'YAML tree', description: t('tools.yaml.features.YAML tree.description'), example: 'Interactive tree' },
  ],
  transform: (input: string) => {
    if (!input.trim()) return []

    const parsed = tryParseYaml(input)
    const validateResult = parsed.ok ? t('yamlTools.valid') : parsed.error
    const invalidResult = parsed.ok ? '' : parsed.error
    const circularError = t('yamlTools.errorPrefix') + t('yamlTools.error.circular')
    const hasCycles = parsed.ok && hasCircularReference(parsed.data)

    const prettyResult = parsed.ok
      ? yaml.dump(parsed.data, { indent: 2, lineWidth: -1 })
      : invalidResult

    const yamlToJsonResult = parsed.ok
      ? hasCycles
        ? circularError
        : JSON.stringify(parsed.data, null, 2)
      : invalidResult

    const structureResult = parsed.ok
      ? hasCycles
        ? circularError
        : isStructured(parsed.data)
        ? analyzeStructure(parsed.data).report
        : t('yamlTools.scalar', { type: parsed.data === null ? 'null' : typeof parsed.data })
      : invalidResult

    return [
      { label: 'Validate', value: validateResult },
      { label: 'Pretty print', value: prettyResult },
      { label: 'YAML → JSON', value: yamlToJsonResult },
      { label: 'Structure', value: structureResult },
      ...(parsed.ok && !hasCycles && isStructured(parsed.data)
        ? [{ label: 'YAML tree' as const, value: '', isTree: true as const, treeKey: 'yaml' as const, treeData: parsed.data }]
        : []),
    ]
  },
  relevance: {
    yaml: { tool: 1.0, transforms: { Validate: 2.0, 'YAML → JSON': 1.5, 'Pretty print': 1.2 } },
    json: { tool: 0.2, transforms: { 'YAML → JSON': 0.3 } },
  },
}
