import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { TextPadView } from '../src/tools/views/TextPadView'
import { I18nProvider } from '../src/i18n/context'

class MockResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}

beforeAll(() => {
  ;(globalThis as { ResizeObserver?: typeof MockResizeObserver }).ResizeObserver = MockResizeObserver
})

describe('TextPadView', () => {
  it('renders the editor container with CodeMirror mounted', () => {
    const { container } = render(
      <I18nProvider>
        <TextPadView />
      </I18nProvider>,
    )
    expect(container.querySelector('[data-testid="text-pad-view"]')).not.toBeNull()
    expect(container.querySelector('.cm-editor')).not.toBeNull()
  })
})
