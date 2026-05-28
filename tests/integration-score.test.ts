import { describe, it, expect } from 'vitest'
import { getAllTools } from '../src/tools/registry'
import { detectInputTypes } from '../src/tools/detect'
import { scoreTool, scoreTransform, matchesScope } from '../src/tools/score'

describe('integration: smart tile prioritization', () => {
  const tools = getAllTools()

  it('ranks encodeTool first for Base64 input', () => {
    const input = 'SGVsbG8gV29ybGQ='
    const detections = detectInputTypes(input)

    const scored = tools.map(t => ({
      id: t.id,
      score: scoreTool(t, detections) + (matchesScope(t.scope, input) ? 0 : -1),
    }))
    scored.sort((a, b) => b.score - a.score)

    expect(scored[0].id).toBe('encode')
  })

  it('ranks encodeTool "Base64 decode" above "Base64 encode" for Base64 input', () => {
    const input = 'SGVsbG8gV29ybGQ='
    const detections = detectInputTypes(input)
    const encode = tools.find(t => t.id === 'encode')!

    const decodeScore = scoreTransform(encode, 'Base64 decode', detections)
    const encodeScore = scoreTransform(encode, 'Base64 encode', detections)
    expect(decodeScore).toBeGreaterThan(encodeScore)
  })

  it('ranks jsonTool first for JSON input', () => {
    const input = '{"name":"John","age":30}'
    const detections = detectInputTypes(input)

    const scored = tools.map(t => ({
      id: t.id,
      score: scoreTool(t, detections) + (matchesScope(t.scope, input) ? 0 : -1),
    }))
    scored.sort((a, b) => b.score - a.score)

    expect(scored[0].id).toBe('json')
  })

  it('ranks caseTool first for camelCase input', () => {
    const input = 'myVariableName'
    const detections = detectInputTypes(input)

    const scored = tools.map(t => ({
      id: t.id,
      score: scoreTool(t, detections) + (matchesScope(t.scope, input) ? 0 : -1),
    }))
    scored.sort((a, b) => b.score - a.score)

    expect(scored[0].id).toBe('case')
  })

  it('demotes caseTool for long input exceeding scope.maxLength', () => {
    const longInput = 'a'.repeat(300)
    const detections = detectInputTypes(longInput)
    const caseTool = tools.find(t => t.id === 'case')!

    const scopePenalty = matchesScope(caseTool.scope, longInput) ? 0 : -1
    const score = scoreTool(caseTool, detections) + scopePenalty
    expect(score).toBeLessThan(0)
  })

  it('ranks blocksTool first for 1C blocks input', () => {
    const input = '{20260416130000,N,\n{0,0},2,1,2,38424377,1,W,"{""key"":""val""}",0,\n{"U"},"",1,1,0,182954,0,\n{0}\n}'
    const detections = detectInputTypes(input)

    const scored = tools.map(t => ({
      id: t.id,
      score: scoreTool(t, detections) + (matchesScope(t.scope, input) ? 0 : -1),
    }))
    scored.sort((a, b) => b.score - a.score)

    expect(scored[0].id).toBe('1c-blocks')
  })

  it('preserves stable order for tools with equal scores', () => {
    const input = 'x'
    const detections = detectInputTypes(input)

    const scored = tools.map((t, i) => ({
      id: t.id,
      score: scoreTool(t, detections) + (matchesScope(t.scope, input) ? 0 : -1),
      index: i,
    }))
    scored.sort((a, b) => b.score - a.score || a.index - b.index)

    const caseEntry = scored.find(s => s.id === 'case')!
    const jsonEntry = scored.find(s => s.id === 'json')!
    expect(caseEntry.score).toBeGreaterThan(jsonEntry.score)

    const zeroScoreIds = scored
      .filter(s => s.score === jsonEntry.score)
      .map(s => s.id)
    const originalZeroScoreIds = tools
      .filter((t) => {
        const s = scoreTool(t, detections) + (matchesScope(t.scope, input) ? 0 : -1)
        return s === jsonEntry.score
      })
      .map(t => t.id)
    expect(zeroScoreIds).toEqual(originalZeroScoreIds)
  })
})
