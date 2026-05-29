import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'
import { useTranslation } from '../i18n/context'
import { MAX_INPUT_BYTES, MAX_INPUT_SIZE_LABEL, getUtf8ByteLength, truncateUtf8ByBytes } from '../utils/text-limit'

export function SmartInput() {
  const { t } = useTranslation()
  const input = useStore(s => s.input)
  const setInput = useStore(s => s.setInput)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      const newHeight = Math.min(el.scrollHeight, 240)
      el.style.height = newHeight + 'px'
      el.style.overflowY = el.scrollHeight > 240 ? 'auto' : 'hidden'
    }
  }, [input])

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
    <div className="w-full max-w-xl mx-auto">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder={t('smartInput.placeholder')}
          className="block w-full bg-surface border border-border rounded-xl px-4 py-3 pr-10 font-mono text-sm text-text resize-none outline-none overflow-y-hidden focus:border-accent/50 transition-colors placeholder:text-muted/40 scrollbar-transparent"
          rows={1}
        />
        {input && (
          <div className="absolute right-3 top-3 flex gap-1">
            <button
              onClick={() => setInput('')}
              className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center text-muted hover:text-text transition-colors text-xs"
            >
              ✕
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
