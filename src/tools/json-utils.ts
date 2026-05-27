import { t } from '../i18n/context'

export function flattenJson(obj: unknown, prefix = ''): Record<string, unknown> {
  const result: Record<string, unknown> = {}

  if (obj === null || typeof obj !== 'object') return result

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const key = prefix ? `${prefix}.${i}` : `${i}`
      if (obj[i] !== null && typeof obj[i] === 'object') {
        Object.assign(result, flattenJson(obj[i], key))
      } else {
        result[key] = obj[i]
      }
    }
    return result
  }

  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object') {
      Object.assign(result, flattenJson(v, key))
    } else {
      result[key] = v
    }
  }

  return result
}

export function unflattenJson(obj: Record<string, unknown>): unknown {
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    const parts = key.split('.')
    let current: Record<string, unknown> = result

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i]
      const nextPart = parts[i + 1]
      const isArrayKey = /^\d+$/.test(nextPart)

      if (!(part in current)) {
        current[part] = isArrayKey ? [] : {}
      }

      const next = current[part]
      if (Array.isArray(next)) {
        const idx = parseInt(nextPart, 10)
        while (next.length <= idx) next.push(undefined as unknown)
        if (i + 1 < parts.length - 1) {
          if (next[idx] === undefined || next[idx] === null) {
            next[idx] = /^\d+$/.test(parts[i + 2]) ? [] : {}
          }
        }
        current = next as unknown as Record<string, unknown>
      } else {
        current = next as Record<string, unknown>
      }
    }

    const lastPart = parts[parts.length - 1]
    if (/^\d+$/.test(lastPart) && Array.isArray(current)) {
      current[parseInt(lastPart, 10)] = value
    } else {
      current[lastPart] = value
    }
  }

  return result
}

export interface StructureAnalysis {
  keyCount: number
  maxDepth: number
  types: string[]
  arrayCount: number
  totalElements: number
  isArray: boolean
  report: string
}

export function analyzeStructure(data: unknown, depth = 0): StructureAnalysis {
  if (data === null || typeof data !== 'object') {
    return { keyCount: 0, maxDepth: depth, types: [], arrayCount: 0, totalElements: 0, isArray: false, report: '' }
  }

  const types = new Set<string>()
  let keyCount = 0
  let maxDepth = depth + 1
  let arrayCount = 0
  let totalElements = 0

  if (Array.isArray(data)) {
    arrayCount++
    totalElements += data.length
    for (const item of data) {
      types.add(typeof item)
      if (item !== null && typeof item === 'object') {
        const child = analyzeStructure(item, depth + 1)
        keyCount += child.keyCount
        maxDepth = Math.max(maxDepth, child.maxDepth)
        arrayCount += child.arrayCount
        totalElements += child.totalElements
        for (const t of child.types) types.add(t)
      }
    }
  } else {
    const entries = Object.entries(data as Record<string, unknown>)
    keyCount = entries.length
    for (const [, v] of entries) {
      types.add(v === null ? 'null' : typeof v)
      if (v !== null && typeof v === 'object') {
        const child = analyzeStructure(v, depth + 1)
        keyCount += child.keyCount
        maxDepth = Math.max(maxDepth, child.maxDepth)
        arrayCount += child.arrayCount
        totalElements += child.totalElements
        for (const t of child.types) types.add(t)
      }
    }
  }

  const uniqueTypes = [...types]
  const isArray = Array.isArray(data)

  const lines = [
    t('json.keys', { n: keyCount }),
    t('json.depth', { n: maxDepth }),
    t('json.types', { types: uniqueTypes.join(', ') }),
    t('json.arrays', { n: arrayCount }),
    t('json.elements', { n: totalElements }),
    isArray ? t('json.formatArray') : t('json.formatObject'),
  ]
  const report = lines.join('\n')

  return { keyCount, maxDepth, types: uniqueTypes, arrayCount, totalElements, isArray, report }
}
