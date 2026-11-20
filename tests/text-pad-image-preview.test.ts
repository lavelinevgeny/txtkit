import { afterEach, expect, it, vi } from 'vitest'
import { waitFor } from '@testing-library/react'
import { EditorView } from '@codemirror/view'
import { createEditorState } from '../src/tools/text-pad/editorStateFactory'

let view: EditorView | undefined
afterEach(() => {
  view?.destroy()
  view = undefined
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function preview(online: boolean) {
  const revoke = vi.fn()
  vi.stubGlobal('URL', class extends URL {
    static createObjectURL = () => 'blob:preview'
    static revokeObjectURL = revoke
  })
  vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(online)
  view = new EditorView({
    parent: document.body,
    state: createEditorState({
      doc: '\uFFFC', images: [{ offset: 0, imageId: 'a' }],
      imageFiles: { a: { bytes: new Uint8Array([0, 42, 255]), mimeType: 'image/png' } },
      imageServices: { t: key => key, notify: vi.fn() },
    }),
  })
  const widget = view.dom.querySelector<HTMLElement>('.cm-pad-image')!
  return { img: widget.querySelector('img')!, widget, revoke }
}

it('uses local bytes once if an offline blob URL fails and keeps the localized decode error', () => {
  const { img, widget, revoke } = preview(false)
  const encode = vi.spyOn(window, 'btoa')
  img.dispatchEvent(new Event('error'))
  expect(img.src).toBe('data:image/png;base64,ACr/')
  img.dispatchEvent(new Event('error'))
  expect(widget.textContent).toBe('textPad.image.previewError')
  expect(encode).toHaveBeenCalledOnce()
  view!.destroy()
  view = undefined
  expect(revoke).toHaveBeenCalledWith('blob:preview')
  expect(img.hasAttribute('src')).toBe(false)
})

it('reports ordinary decode failures directly while online', () => {
  const { img, widget } = preview(true)
  const encode = vi.spyOn(window, 'btoa')
  img.dispatchEvent(new Event('error'))
  expect(widget.textContent).toBe('textPad.image.previewError')
  expect(encode).not.toHaveBeenCalled()
})

it('keeps the image, selection and focused control through resizing, reset and Escape', () => {
  const { img, widget, revoke } = preview(true)
  const selection = view!.state.selection
  const trigger = widget.querySelector('button')!
  const panel = view!.dom.querySelector<HTMLElement>('[role=group]')!
  const [minus, reset] = panel.querySelectorAll('button')
  trigger.click()
  expect(panel.hidden).toBe(false)
  expect(document.activeElement).toBe(minus)
  for (const value of [75, 50, 25]) {
    minus.click()
    expect(reset.textContent).toBe(value + '%')
    expect(document.activeElement).toBe(minus)
    expect(widget.querySelector('img')).toBe(img)
  }
  expect(minus).toHaveAttribute('aria-disabled', 'true')
  minus.click()
  expect(reset.textContent).toBe('25%')
  reset.click()
  expect(reset.textContent).toBe('100%')
  expect(view!.state.selection).toBe(selection)
  expect(revoke).not.toHaveBeenCalled()
  minus.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
  expect(panel.hidden).toBe(true)
  expect(document.activeElement).toBe(trigger)
})

it('fits the controls outside a thumbnail at either edge of the visible editor', async () => {
  const { widget } = preview(true)
  const editor = view!
  const trigger = widget.querySelector('button')!
  const panel = editor.dom.querySelector<HTMLElement>('[role=group]')!
  Object.defineProperties(Range.prototype, {
    getClientRects: { configurable: true, value: () => [] },
    getBoundingClientRect: { configurable: true, value: () => new DOMRect() },
  })
  const viewport = new DOMRect(10, 50, 300, 200)
  vi.spyOn(editor.dom, 'getBoundingClientRect').mockReturnValue(viewport)
  vi.spyOn(editor.scrollDOM, 'getBoundingClientRect').mockReturnValue(viewport)
  Object.defineProperties(editor.scrollDOM, { clientWidth: { value: 300 }, clientHeight: { value: 200 } })
  vi.spyOn(panel, 'getBoundingClientRect').mockReturnValue(new DOMRect(0, 0, 134, 46))
  const image = vi.spyOn(trigger, 'getBoundingClientRect').mockReturnValue(new DOMRect(295, 51, 12, 9))
  trigger.click()
  await waitFor(() => expect(panel.style.top).toBe('1px'))
  expect(panel.style.left).toBe('147px')

  panel.querySelector('button')!.click()
  image.mockReturnValue(new DOMRect(12, 235, 12, 9))
  await new Promise(resolve => requestAnimationFrame(resolve))
  expect(panel.style.top).toBe('1px')
  expect(panel.style.left).toBe('147px')

  editor.scrollDOM.dispatchEvent(new Event('scroll'))
  await waitFor(() => expect(panel.style.top).toBe('154px'))
  expect(panel.style.left).toBe('18px')
})
