export const buttonBase =
  'rounded-lg border px-2.5 py-1.5 text-xs font-mono transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
export const buttonIdle = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
export const buttonActive = `${buttonBase} border-accent/60 bg-accent/15 text-accent`
export const buttonDanger = `${buttonBase} border-border-dim bg-surface-dim text-muted hover:border-red-400/40 hover:text-red-300`
export const buttonDisabled = 'disabled:opacity-40 disabled:hover:border-border-dim disabled:hover:text-muted'

/** Квадратная кнопка с иконкой 16px — той же высоты, что и текстовые кнопки панели. */
const iconButtonBase =
  'inline-flex items-center justify-center rounded-lg border p-1.5 transition-colors focus:outline-none focus:ring-2 focus:ring-accent/30'
export const iconButtonIdle = `${iconButtonBase} border-border-dim bg-surface-dim text-muted hover:border-accent/40 hover:text-accent`
export const iconButtonActive = `${iconButtonBase} border-accent/60 bg-accent/15 text-accent`

/** Компактная иконка-кнопка внутри плиток результатов (24px — как кнопка «Скопировать»). */
export const tileIconButton =
  'inline-flex items-center justify-center rounded-md p-1 text-muted transition-colors hover:bg-zinc-800 hover:text-accent focus:outline-none focus:ring-2 focus:ring-accent/30'
