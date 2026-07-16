import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'

export const mermaidTool: ToolDescriptor = {
  id: 'mermaid',
  name: 'Mermaid',
  icon: '▶',
  category: 'dev',
  description: t('tools.mermaid.description'),
  view: 'custom',
  features: [
    {
      label: 'Диаграммы из текста',
      description: t('tools.mermaid.features.textToDiagram.description'),
      example: 'graph TD\n  A --> B',
    },
    {
      label: 'Поддержка форматов',
      description: t('tools.mermaid.features.formats.description'),
      example: 'flowchart, sequence, class, state, ER, Gantt, pie',
    },
    {
      label: 'Автообновление',
      description: t('tools.mermaid.features.autoRefresh.description'),
      example: 'Диаграмма обновляется автоматически при изменении текста.',
    },
  ],
}
