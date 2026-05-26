export type Category = 'transform' | 'analysis' | 'encoding' | 'dev'

export interface TransformResult {
  label: string
  value: string
}

export interface DetectionResult {
  type: string
  label: string
  confidence: number
}

export interface ToolDescriptor {
  id: string
  name: string
  icon: string
  category: Category
  description: string
  detect?: (input: string) => DetectionResult | null
  transform: (input: string) => TransformResult[]
}
