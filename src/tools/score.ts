import type { ToolDescriptor, DetectionResult, ToolScope } from '../types/tool'

export function scoreTool(
  tool: ToolDescriptor,
  detections: DetectionResult[],
): number {
  if (!tool.relevance) return 0
  let score = 0
  for (const d of detections) {
    const config = tool.relevance[d.type]
    if (config) {
      score += d.confidence * config.tool
    }
  }
  return score
}

export function scoreTransform(
  tool: ToolDescriptor,
  transformLabel: string,
  detections: DetectionResult[],
): number {
  if (!tool.relevance) return 0
  let score = 0
  for (const d of detections) {
    const config = tool.relevance[d.type]
    if (config?.transforms?.[transformLabel]) {
      score += d.confidence * config.transforms[transformLabel]
    }
  }
  return score
}

export function matchesScope(scope: ToolScope | undefined, input: string): boolean {
  if (!scope) return true
  if (scope.maxLength !== undefined && input.length > scope.maxLength) return false
  if (scope.minLength !== undefined && input.length < scope.minLength) return false
  if (scope.singleLine && input.includes('\n')) return false
  if (scope.multiLine && !input.includes('\n')) return false
  return true
}

export function getEffectiveInput(
  input: string,
  scope: ToolScope | undefined,
  isManual: boolean,
): { input: string; truncated: boolean; originalLength: number; limit: number } {
  if (!isManual || !scope?.truncate || input.length <= scope.truncate.maxLength) {
    return { input, truncated: false, originalLength: input.length, limit: 0 }
  }
  return {
    input: input.slice(0, scope.truncate.maxLength),
    truncated: true,
    originalLength: input.length,
    limit: scope.truncate.maxLength,
  }
}
