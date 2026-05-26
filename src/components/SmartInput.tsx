import { useRef, useEffect } from 'react'
import { useStore } from '../store/useStore'

const MAX_INPUT_LENGTH = 5000

export function SmartInput() {
  const input = useStore(s => s.input)
  const setInput = useStore(s => s.setInput)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    const el = textareaRef.current
    if (el) {
      el.style.height = 'auto'
      el.style.height = Math.min(el.scrollHeight, 240) + 'px'
    }
  }, [input])

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const value = e.target.value
    if (value.length <= MAX_INPUT_LENGTH) {
      setInput(value)
    }
  }

  const handlePaste = (e: React.ClipboardEvent) => {
    const pasted = e.clipboardData.getData('text')
    if (pasted.length > MAX_INPUT_LENGTH) {
      e.preventDefault()
      setInput(pasted.slice(0, MAX_INPUT_LENGTH))
    }
  }

  const showWarning = input.length > MAX_INPUT_LENGTH * 0.9

  return (
    <div className="w-full max-w-xl mx-auto">
      <div className="relative">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={handleChange}
          onPaste={handlePaste}
          placeholder="Вставьте или введите текст..."
          className="w-full bg-surface border border-border rounded-xl px-4 py-3 font-mono text-sm text-text resize-none outline-none focus:border-accent/50 transition-colors placeholder:text-muted/40"
          rows={1}
        />
        {input && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2 flex gap-1">
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
          Текст обрезан до {MAX_INPUT_LENGTH} символов
        </p>
      )}
    </div>
  )
}
