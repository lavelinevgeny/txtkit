import type { ToolDescriptor, Category } from '../types/tool'
import { caseTool } from './case'
import { statsTool } from './stats'
import { transformsTool } from './transforms'
import { encodeTool } from './encode'
import { jsonTool } from './json'

const tools: ToolDescriptor[] = [caseTool, transformsTool, statsTool, encodeTool, jsonTool]

export function getAllTools(): ToolDescriptor[] {
  return tools
}

export function getToolsByCategory(): Record<Category, ToolDescriptor[]> {
  const groups: Record<string, ToolDescriptor[]> = {}
  for (const tool of tools) {
    if (!groups[tool.category]) groups[tool.category] = []
    groups[tool.category].push(tool)
  }
  return groups as Record<Category, ToolDescriptor[]>
}

export function getToolById(id: string): ToolDescriptor | undefined {
  return tools.find(t => t.id === id)
}
