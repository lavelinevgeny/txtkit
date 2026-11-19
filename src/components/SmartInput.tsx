import { useCallback, useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'
import { useTranslation } from '../i18n/context'
import { MAX_INPUT_BYTES, MAX_INPUT_SIZE_LABEL, getUtf8ByteLength, truncateUtf8ByBytes } from '../utils/text-limit'

/** Начальный отступ кнопки очистки (до первого измерения поля). */
const CLEAR_BUTTON_INSET = 11

interface SmartInputProps {
  /** Поле занимает всю высоту контейнера (развёрнутый режим) вместо авто-роста до 240px. */
  fill?: boolean
}

export function SmartInput({ fill = false }: SmartInputProps) {
  const { t } = useTranslation()
  const input = useStore(s => s.input)
  const setInput = useStore(s => s.setInput)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const clearButtonRef = useRef<HTMLDivElement>(null)

  // Кнопка очистки центрируется по высоте однострочного поля: в одну строку отступы
  // сверху, снизу и справа равны, в многострочном — кнопка стоит напротив первой строки.
  // Справа добавляется ширина полосы прокрутки, чтобы кнопка не прижималась к ней.
  const alignClearButton = useCallback(() => {
    const el = textareaRef.current
    const button = clearButtonRef.current
    if (!el || !button) return
    const style = getComputedStyle(el)
    const px = (value: string) => parseFloat(value) || 0
    const fontSize = px(style.fontSize) || 14
    const lineHeight = px(style.lineHeight) || fontSize * 1.2
    const singleLineHeight =
      px(style.borderTopWidth) + px(style.paddingTop) + lineHeight + px(style.paddingBottom) + px(style.borderBottomWidth)
    const buttonHeight = button.offsetHeight
    const inset = buttonHeight > 0 && singleLineHeight > buttonHeight
      ? (singleLineHeight - buttonHeight) / 2
      : CLEAR_BUTTON_INSET
    const scrollbar = Math.max(0, el.offsetWidth - el.clientWidth - px(style.borderLeftWidth) - px(style.borderRightWidth))
    button.style.top = `${inset}px`
    button.style.right = `${inset + scrollbar}px`
  }, [])

  useEffect(() => {
    const el = textareaRef.current
    if (!el || typeof ResizeObserver === 'undefined') return undefined
    const observer = new ResizeObserver(alignClearButton)
    observer.observe(el)
    return () => observer.disconnect()
  }, [alignClearButton])

  useEffect(() => {
    const el = textareaRef.current
    if (el && fill) {
      el.style.height = ''
      el.style.overflowY = ''
    } else if (el) {
      // scrollHeight не включает рамку, а height задаётся с рамкой (border-box) —
      // без поправки поле на 2px ниже содержимого и кнопка очистки смещается.
      const style = getComputedStyle(el)
      const borders = (parseFloat(style.borderTopWidth) || 0) + (parseFloat(style.borderBottomWidth) || 0)
      el.style.height = 'auto'
      const fullHeight = el.scrollHeight + borders
      el.style.height = Math.min(fullHeight, 240) + 'px'
      el.style.overflowY = fullHeight > 240 ? 'auto' : 'hidden'
    }
    alignClearButton()
  }, [input, fill, alignClearButton])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    const truncatedValue = truncateUtf8ByBytes(value, MAX_INPUT_BYTES)
    if (truncatedValue !== input) {
      setInput(truncatedValue)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text')
    const el = textareaRef.current
    if (!el) {
      return
    }

    const nextValue = input.slice(0, el.selectionStart) + pasted + input.slice(el.selectionEnd)
    const truncatedValue = truncateUtf8ByBytes(nextValue, MAX_INPUT_BYTES)

    if (truncatedValue !== nextValue) {
      e.preventDefault()
      if (truncatedValue !== input) {
        setInput(truncatedValue)
      }
    }
  }

  const showWarning = getUtf8ByteLength(input) > MAX_INPUT_BYTES * 0.9

  return (
    <div className={fill ? 'flex h-full min-h-0 w-full flex-col' : 'w-full max-w-xl mx-auto'}>
      <div className={fill ? 'relative min-h-0 flex-1' : 'relative'}>
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={t('smartInput.placeholder')}
          className={`block w-full bg-surface border border-border rounded-xl px-4 py-3 pr-10 font-mono text-sm text-text resize-none outline-none focus:border-accent/50 transition-colors placeholder:text-muted/40 ${
            fill ? 'h-full overflow-y-auto scrollbar-thin' : 'overflow-y-hidden scrollbar-transparent'
          }`}
          rows={1}
        />
        {input && (
          <div
            ref={clearButtonRef}
            className="absolute flex gap-1"
            style={{ top: CLEAR_BUTTON_INSET, right: CLEAR_BUTTON_INSET }}
          >
            <button
              type="button"
              onClick={() => setInput('')}
              aria-label={t('smartInput.clear')}
              title={t('smartInput.clear')}
              className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-muted hover:text-text transition-colors"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>
        )}
      </div>
      {showWarning && input && (
        <p className="text-xs text-amber-500 mt-1">
          {t('smartInput.lengthWarning', { max: MAX_INPUT_SIZE_LABEL })}
        </p>
      )}
    </div>
  )
}
