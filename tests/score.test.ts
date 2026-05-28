import { describe, it, expect } from 'vitest'
import { scoreTool, scoreTransform, matchesScope, getEffectiveInput } from '../src/tools/score'
import type { ToolDescriptor, DetectionResult, ToolScope } from '../src/types/tool'

const makeTool = (partial: Partial<ToolDescriptor> & { id: string }): ToolDescriptor => ({
  name: partial.id,
  icon: '?',
  category: 'transform',
  description: '',
  transform: () => [],
  ...partial,
})

describe('scoreTool', () => {
  it('returns 0 for tool without relevance', () => {
    const tool = makeTool({ id: 'test' })
    const detections: DetectionResult[] = [{ type: 'json', label: 'JSON', confidence: 0.95 }]
    expect(scoreTool(tool, detections)).toBe(0)
  })

  it('sums confidence * weight for matching detections', () => {
    const tool = makeTool({
      id: 'json',
      relevance: {
        json: { tool: 1.0 },
        yaml: { tool: 0.8 },
      },
    })
    const detections: DetectionResult[] = [
      { type: 'json', label: 'JSON', confidence: 0.95 },
      { type: 'yaml', label: 'YAML', confidence: 0.7 },
    ]
    expect(scoreTool(tool, detections)).toBeCloseTo(0.95 * 1.0 + 0.7 * 0.8)
  })

  it('ignores detections not in relevance config', () => {
    const tool = makeTool({
      id: 'json',
      relevance: { json: { tool: 1.0 } },
    })
    const detections: DetectionResult[] = [
      { type: 'json', label: 'JSON', confidence: 0.95 },
      { type: 'base64', label: 'Base64', confidence: 0.9 },
    ]
    expect(scoreTool(tool, detections)).toBeCloseTo(0.95)
  })

  it('returns 0 for empty detections', () => {
    const tool = makeTool({
      id: 'json',
      relevance: { json: { tool: 1.0 } },
    })
    expect(scoreTool(tool, [])).toBe(0)
  })
})

describe('scoreTransform', () => {
  it('returns 0 for tool without relevance', () => {
    const tool = makeTool({ id: 'test' })
    const detections: DetectionResult[] = [{ type: 'base64', label: 'Base64', confidence: 0.9 }]
    expect(scoreTransform(tool, 'Base64 decode', detections)).toBe(0)
  })

  it('returns 0 when no transforms config for detection type', () => {
    const tool = makeTool({
      id: 'encode',
      relevance: { base64: { tool: 1.0 } },
    })
    const detections: DetectionResult[] = [{ type: 'base64', label: 'Base64', confidence: 0.9 }]
    expect(scoreTransform(tool, 'Base64 decode', detections)).toBe(0)
  })

  it('sums confidence * transform weight across detections', () => {
    const tool = makeTool({
      id: 'encode',
      relevance: {
        base64: { tool: 1.0, transforms: { 'Base64 decode': 2.0, 'Base64 encode': 0.5 } },
        'url-encoded': { tool: 1.0, transforms: { 'Base64 decode': 0.1 } },
      },
    })
    const detections: DetectionResult[] = [
      { type: 'base64', label: 'Base64', confidence: 0.9 },
      { type: 'url-encoded', label: 'URL', confidence: 0.5 },
    ]
    expect(scoreTransform(tool, 'Base64 decode', detections)).toBeCloseTo(0.9 * 2.0 + 0.5 * 0.1)
  })

  it('returns 0 for label not in transforms config', () => {
    const tool = makeTool({
      id: 'encode',
      relevance: { base64: { tool: 1.0, transforms: { 'Base64 decode': 2.0 } } },
    })
    const detections: DetectionResult[] = [{ type: 'base64', label: 'Base64', confidence: 0.9 }]
    expect(scoreTransform(tool, 'Unknown', detections)).toBe(0)
  })
})

describe('matchesScope', () => {
  it('returns true when scope is undefined', () => {
    expect(matchesScope(undefined, 'any text')).toBe(true)
  })

  it('returns false when input exceeds maxLength', () => {
    const scope: ToolScope = { maxLength: 5 }
    expect(matchesScope(scope, '123456')).toBe(false)
  })

  it('returns true when input equals maxLength', () => {
    const scope: ToolScope = { maxLength: 5 }
    expect(matchesScope(scope, '12345')).toBe(true)
  })

  it('returns false when input below minLength', () => {
    const scope: ToolScope = { minLength: 5 }
    expect(matchesScope(scope, '123')).toBe(false)
  })

  it('returns false when singleLine and input has newline', () => {
    const scope: ToolScope = { singleLine: true }
    expect(matchesScope(scope, 'line1\nline2')).toBe(false)
  })

  it('returns true when singleLine and input has no newline', () => {
    const scope: ToolScope = { singleLine: true }
    expect(matchesScope(scope, 'line1')).toBe(true)
  })

  it('returns false when multiLine and input has no newline', () => {
    const scope: ToolScope = { multiLine: true }
    expect(matchesScope(scope, 'line1')).toBe(false)
  })

  it('returns true when all scope conditions satisfied', () => {
    const scope: ToolScope = { maxLength: 100, singleLine: true }
    expect(matchesScope(scope, 'short line')).toBe(true)
  })

  it('returns false when any scope condition fails', () => {
    const scope: ToolScope = { maxLength: 100, singleLine: true }
    expect(matchesScope(scope, 'short\nline')).toBe(false)
  })
})

describe('getEffectiveInput', () => {
  it('returns full input when not manual mode', () => {
    const scope: ToolScope = { truncate: { maxLength: 5 } }
    const result = getEffectiveInput('1234567890', scope, false)
    expect(result.input).toBe('1234567890')
    expect(result.truncated).toBe(false)
  })

  it('returns full input when manual but no scope', () => {
    const result = getEffectiveInput('1234567890', undefined, true)
    expect(result.input).toBe('1234567890')
    expect(result.truncated).toBe(false)
  })

  it('returns full input when manual but no truncate config', () => {
    const scope: ToolScope = { maxLength: 5 }
    const result = getEffectiveInput('1234567890', scope, true)
    expect(result.input).toBe('1234567890')
    expect(result.truncated).toBe(false)
  })

  it('truncates input when manual and exceeds truncate.maxLength', () => {
    const scope: ToolScope = { truncate: { maxLength: 5 } }
    const result = getEffectiveInput('1234567890', scope, true)
    expect(result.input).toBe('12345')
    expect(result.truncated).toBe(true)
    expect(result.originalLength).toBe(10)
    expect(result.limit).toBe(5)
  })

  it('returns full input when manual and within truncate.maxLength', () => {
    const scope: ToolScope = { truncate: { maxLength: 20 } }
    const result = getEffectiveInput('1234567890', scope, true)
    expect(result.input).toBe('1234567890')
    expect(result.truncated).toBe(false)
  })
})
