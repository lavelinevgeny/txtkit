export type Category = 'transform' | 'analysis' | 'encoding' | 'json' | 'yaml' | 'dev'

export interface TransformResult {
  label: string
  value: string
  isTree?: boolean
  treeKey?: string
  treeData?: unknown
}

export interface DetectionResult {
  type: string
  label: string
  confidence: number
}

export interface RelevanceConfig {
  [detectionType: string]: {
    tool: number
    transforms?: {
      [transformLabel: string]: number
    }
  }
}

export interface ToolScope {
  maxLength?: number
  minLength?: number
  singleLine?: boolean
  multiLine?: boolean
  truncate?: {
    maxLength: number
  }
}

export interface ToolDescriptor {
  id: string
  name: string
  icon: string
  category: Category
  description: string
  features?: { label: string; description: string; example: string }[]
  detect?: (input: string) => DetectionResult | null
  transform: (input: string) => TransformResult[]
  relevance?: RelevanceConfig
  scope?: ToolScope
}
