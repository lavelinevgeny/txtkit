import { afterEach, expect, it, vi } from 'vitest'
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
