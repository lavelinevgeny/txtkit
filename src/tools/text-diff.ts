import type { ToolDescriptor } from '../types/tool'
import { t } from '../i18n/translate'

export const textDiffTool: ToolDescriptor = {
  id: 'text-diff',
  name: 'Text Diff',
  icon: '±',
  category: 'analysis',
  description: t('tools.text-diff.description'),
  view: 'custom',
  features: [
    {
      label: 'Сравнение бок о бок',
      description: t('tools.text-diff.features.sideBySide.description'),
      example: 'Слева оригинал, справа изменённый текст, различия подсвечены.',
    },
    {
      label: 'Пословная подсветка',
      description: t('tools.text-diff.features.wordLevel.description'),
      example: 'Изменённые слова внутри строки выделяются точечно.',
    },
    {
      label: 'Гибкое сравнение',
      description: t('tools.text-diff.features.options.description'),
      example: 'Игнорировать регистр и пробелы по краям строк.',
    },
    {
      label: 'Статистика различий',
      description: t('tools.text-diff.features.stats.description'),
      example: 'Сколько строк добавлено, удалено и изменено.',
    },
    {
      label: 'Навигация',
      description: t('tools.text-diff.features.navigation.description'),
      example: 'Синхронный скролл панелей и мини-карта различий сбоку.',
    },
  ],
}
