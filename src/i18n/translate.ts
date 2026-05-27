import { useStore, type Locale } from '../store/useStore'
import ru from './locales/ru.json'
import en from './locales/en.json'

const locales: Record<Locale, Record<string, string>> = { ru, en }

export function t(key: string, params?: Record<string, string | number>): string {
  const locale = useStore.getState().locale
  let value = locales[locale][key] ?? locales.en[key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, String(v))
    }
  }
  return value
}
