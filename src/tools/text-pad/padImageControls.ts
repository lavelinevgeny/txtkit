import { historyKeymap, isolateHistory, redo, undo } from '@codemirror/commands'
import { EditorView, keymap, runScopeHandlers, ViewPlugin } from '@codemirror/view'
import type { ViewUpdate } from '@codemirror/view'
import { autoImageHeight, autoImageWidth, imageScaleStep, maxImageScale, previousImageScale, scaledImageWidth } from './padImageSize'
import { imageText, padImageBindings, resizePadImage } from './padImageState'

const triggerSelector = '.cm-pad-image-trigger'
const controlsScope = 'pad-image-controls'

function button(label: string) {
  const element = document.createElement('button')
  element.type = 'button'
  element.textContent = label
  return element
}

function labelButton(element: HTMLButtonElement, label: string, disabled: boolean) {
  element.title = label
  element.setAttribute('aria-label', label)
  // A control that reaches its limit keeps keyboard focus.
  element.setAttribute('aria-disabled', String(disabled))
}

export const imageControls = ViewPlugin.fromClass(class {
  readonly view: EditorView
  readonly panel = document.createElement('div')
  readonly minus = button('−')
  readonly reset = button('')
  readonly plus = button('+')
  readonly observer?: ResizeObserver
  readonly gutter: HTMLElement | null
  active: HTMLButtonElement | null = null
  available = 0
  viewport: number[] = []
  // Keep a stationary pointer over the same action as the image grows or shrinks.
  pinned: { x: number; y: number; scrollTop: number } | null = null

  constructor(view: EditorView) {
    this.view = view
    this.gutter = view.scrollDOM.querySelector('.cm-gutters')
    this.panel.className = 'cm-pad-image-controls'
    this.panel.setAttribute('role', 'group')
    this.reset.setAttribute('aria-live', 'polite')
    this.panel.hidden = true
    this.panel.append(this.minus, this.reset, this.plus)
    view.dom.append(this.panel)
    view.dom.addEventListener('click', this.click)
    view.dom.addEventListener('keydown', this.keydown)
    view.dom.addEventListener('focusout', this.focusout)
    view.dom.ownerDocument.addEventListener('pointerdown', this.outside, true)
    view.dom.ownerDocument.addEventListener('scroll', this.scroll, true)
    window.addEventListener('resize', this.measure)
    if (typeof ResizeObserver !== 'undefined') {
      this.observer = new ResizeObserver(this.measure)
      this.observer.observe(view.scrollDOM)
      if (this.gutter) this.observer.observe(this.gutter)
    }
    this.measure()
  }

  binding() {
    return padImageBindings(this.view.state).find(b => b.imageId === this.active?.dataset.imageId)
  }

  refresh() {
    const binding = this.binding()
    const img = this.active?.querySelector('img')
    if (!binding || !img || !this.active?.isConnected) return this.close()
    const state = this.view.state
    const scale = binding.scale ?? 100
    const base = autoImageWidth(img)
    const next = scale + imageScaleStep
    const capped = scaledImageWidth(base, this.available, next) <= scaledImageWidth(base, this.available, scale)
    this.panel.setAttribute('aria-label', imageText(state, 'resize'))
    if (this.reset.textContent !== scale + '%') this.reset.textContent = scale + '%'
    labelButton(this.reset, scale + '%, ' + imageText(state, 'resetSize'), scale === 100)
    labelButton(this.minus, imageText(state, 'decreaseSize'), scale <= imageScaleStep)
    labelButton(this.plus, imageText(state, 'increaseSize'), next > maxImageScale || capped)
  }

  click = (event: MouseEvent) => {
    if (!(event.target instanceof Element)) return
    const target = event.target.closest<HTMLButtonElement>('button')
    if (target?.matches(triggerSelector)) {
      this.close()
      this.active = target
      target.setAttribute('aria-expanded', 'true')
      this.observer?.observe(target)
      this.panel.hidden = false
      this.refresh()
      this.measure()
      this.minus.focus({ preventScroll: true })
    } else if (target && this.panel.contains(target)) {
      const binding = this.binding()
      if (!binding || target.getAttribute('aria-disabled') === 'true') return
      const scale = binding.scale ?? 100
      if (this.panel.style.left) {
        this.pinned = {
          x: parseFloat(this.panel.style.left), y: parseFloat(this.panel.style.top),
          scrollTop: this.view.scrollDOM.scrollTop,
        }
      }
      let next = 100
      if (target === this.plus) next = scale + imageScaleStep
      if (target === this.minus) {
        const image = this.active?.querySelector('img')
        if (!image) return
        next = previousImageScale(autoImageWidth(image), this.available, scale)
      }
      this.view.dispatch({
        // Keep the viewport at its current line even when the last line grows.
        effects: [resizePadImage.of({ imageId: binding.imageId, scale: next }), this.view.scrollSnapshot()],
        annotations: isolateHistory.of('full'),
      })
    } else {
      this.close()
    }
  }

  keydown = (event: KeyboardEvent) => {
    if (!this.active) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      const trigger = this.active
      this.close()
      trigger.focus({ preventScroll: true })
    } else if (event.target instanceof Node && this.panel.contains(event.target) &&
      runScopeHandlers(this.view, event, controlsScope)) {
      event.preventDefault()
    }
  }

  outside = (event: PointerEvent) => {
    if (this.active && event.target instanceof Node &&
      !this.active.contains(event.target) && !this.panel.contains(event.target)) this.close()
  }

  focusout = (event: FocusEvent) => {
    const next = event.relatedTarget
    if (this.active && (!(next instanceof Node) || (!this.panel.contains(next) && !this.active.contains(next)))) this.close()
  }

  close() {
    if (this.active) {
      this.observer?.unobserve(this.active)
      this.active.setAttribute('aria-expanded', 'false')
    }
    this.active = null
    this.pinned = null
    this.panel.hidden = true
  }

  scroll = () => { if (this.active) this.measure() }

  measure = () => {
    const view = this.view
    view.requestMeasure({
      key: this,
      read: () => {
        const line = view.contentDOM.querySelector('.cm-line')
        const style = line && getComputedStyle(line)
        const padding = style ? parseFloat(style.paddingLeft) + parseFloat(style.paddingRight) : 30
        const available = Math.max(1, view.scrollDOM.clientWidth - (this.gutter?.offsetWidth ?? 0) - (padding || 0))
        const anchor = this.active
        if (!anchor) return { available }
        const image = anchor.getBoundingClientRect()
        const editor = view.dom.getBoundingClientRect()
        const scroll = view.scrollDOM.getBoundingClientRect()
        const left = Math.max(scroll.left, 0)
        const top = Math.max(scroll.top, 0)
        const right = Math.min(scroll.left + view.scrollDOM.clientWidth, window.innerWidth)
        const bottom = Math.min(scroll.top + view.scrollDOM.clientHeight, window.innerHeight)
        // A taller image may grow the gutter without moving the visible editor.
        const viewport = [left, top, right, bottom, available, editor.left, editor.top, view.scrollDOM.scrollLeft]
        let pinned = this.pinned
        if (pinned) {
          // Shrinking a note can put the original scroll offset below its new end.
          const maxTop = Math.max(0, view.scrollDOM.scrollHeight - view.scrollDOM.clientHeight)
          const expectedTop = Math.min(pinned.scrollTop, maxTop)
          if (Math.abs(view.scrollDOM.scrollTop - expectedTop) > 1 ||
            viewport.some((value, i) => value !== this.viewport[i])) pinned = null
        }
        const panel = this.panel.getBoundingClientRect()
        const gap = 4
        let x = image.left
        let y = image.top
        if (pinned) {
          x = editor.left + pinned.x
          y = editor.top + pinned.y
        } else if (image.right + gap + panel.width <= right) x = image.right + gap
        else if (image.left - gap - panel.width >= left) x = image.left - gap - panel.width
        else if (image.top - gap - panel.height >= top) y = image.top - gap - panel.height
        else if (image.bottom + gap + panel.height <= bottom) y = image.bottom + gap
        return { available, anchor, viewport, pinned,
          visible: image.right >= left && image.left <= right && image.bottom >= top && image.top <= bottom,
          x: Math.max(left, Math.min(right - panel.width, x)) - editor.left,
          y: Math.max(top, Math.min(bottom - panel.height, y)) - editor.top,
        }
      },
      write: layout => {
        this.available = layout.available
        view.dom.style.setProperty('--pad-image-width', layout.available + 'px')
        if (!layout.anchor || this.active !== layout.anchor) return
        if (!layout.visible) return this.close()
        this.viewport = layout.viewport
        this.pinned = layout.pinned
        this.panel.style.left = layout.x + 'px'
        this.panel.style.top = layout.y + 'px'
        this.refresh()
      },
    })
  }

  update(update: ViewUpdate) {
    if (!this.active) return
    if (update.docChanged || !update.startState.selection.eq(update.state.selection)) this.close()
    else {
      this.refresh()
      this.measure()
    }
  }

  destroy() {
    this.close()
    this.observer?.disconnect()
    this.panel.remove()
    this.view.dom.removeEventListener('click', this.click)
    this.view.dom.removeEventListener('keydown', this.keydown)
    this.view.dom.removeEventListener('focusout', this.focusout)
    this.view.dom.ownerDocument.removeEventListener('pointerdown', this.outside, true)
    this.view.dom.ownerDocument.removeEventListener('scroll', this.scroll, true)
    window.removeEventListener('resize', this.measure)
  }
}, {
  provide: () => keymap.of(historyKeymap
    .filter(binding => binding.run === undo || binding.run === redo)
    .map(binding => ({ ...binding, scope: controlsScope }))),
})

export const imageControlsTheme = EditorView.baseTheme({
  '.cm-pad-image-trigger': {
    display: 'inline-block', position: 'relative', verticalAlign: 'middle', lineHeight: '0',
    padding: '0', border: '0', background: 'transparent', cursor: 'pointer',
  },
  '.cm-pad-image-trigger img': {
    display: 'block', maxHeight: autoImageHeight + 'px', maxWidth: 'var(--pad-image-width, 100%)',
    width: 'auto', height: 'auto',
  },
  '.cm-pad-image-trigger img[data-loaded]': {
    maxHeight: 'none',
    width: 'min(calc(var(--pad-image-base) * var(--pad-image-factor)), calc(var(--pad-image-width) * var(--pad-image-factor)))',
  },
  '.cm-pad-image-hint': {
    position: 'absolute', inset: '0', pointerEvents: 'none', containerType: 'size', containerName: 'pad-image-hint',
  },
  '.cm-pad-image-hint::after': {
    content: '""', position: 'absolute', top: '-2px', right: '-2px', width: 'min(7px, 100%)', height: 'min(7px, 100%)',
    borderTop: '2px solid var(--color-accent)', borderRight: '2px solid var(--color-accent)',
  },
  '@container pad-image-hint (min-width: 40px) and (min-height: 40px)': {
    '.cm-pad-image-hint::after': {
      content: '"⤢"', top: '0', right: '0', width: '18px', height: '18px', border: '0', borderRadius: '3px',
      background: 'var(--color-surface)', color: 'var(--color-text)', font: 'bold 14px/18px sans-serif', textAlign: 'center',
    },
  },
  '.cm-pad-image-trigger[aria-expanded=true], .cm-pad-image-trigger:focus-visible': {
    outline: '2px solid var(--color-accent)', outlineOffset: '-2px',
  },
  '.cm-pad-image-controls': {
    position: 'absolute', left: '0', top: '0', zIndex: '6', display: 'flex', alignItems: 'stretch',
    borderRadius: '6px', border: '1px solid var(--color-border)', background: 'var(--color-surface)',
    color: 'var(--color-text)', boxShadow: '0 2px 8px #0008', font: '12px/1 var(--font-mono)',
  },
  '.cm-pad-image-controls[hidden]': { display: 'none' },
  '.cm-pad-image-controls button': { minWidth: '32px', height: '32px', padding: '0 6px', cursor: 'pointer' },
  '.cm-pad-image-controls button:focus-visible': { outline: '2px solid var(--color-accent)', outlineOffset: '-3px' },
  '.cm-pad-image-controls button[aria-disabled=true]': { color: 'var(--color-muted)', cursor: 'default' },
  '.cm-pad-image-controls button:nth-child(2)': { width: '44px', color: 'var(--color-text)', fontVariantNumeric: 'tabular-nums' },
  '@media (any-pointer: coarse)': {
    '.cm-pad-image-controls button': { minWidth: '44px', height: '44px' },
  },
})
