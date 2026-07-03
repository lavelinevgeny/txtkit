import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'

export const textPadTool: ToolDescriptor = {
  id: 'text-pad',
  name: 'Text Pad',
  icon: '✎',
  category: 'transform',
  description: t('tools.text-pad.description'),
  view: 'custom',
  features: [
    {
      label: 'Редактирование больших текстов',
      description: t('tools.text-pad.features.largeText.description'),
      example: 'Вставьте длинный текст и редактируйте его прямо в браузере.',
    },
    {
      label: 'Поиск и замена',
      description: t('tools.text-pad.features.findReplace.description'),
      example: 'Ctrl/Cmd+F, regex, replace, replace all.',
    },
    {
      label: 'Быстрые операции',
      description: t('tools.text-pad.features.quickOps.description'),
      example: 'Удалить дубли, пустые строки, отсортировать, trim.',
    },
    {
      label: 'Автосохранение',
      description: t('tools.text-pad.features.autosave.description'),
      example: 'Текст сохраняется локально, пока помещается в лимит браузера.',
    },
  ],
}
