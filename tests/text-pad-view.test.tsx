import { describe, it, expect, beforeAll } from 'vitest'
import { render } from '@testing-library/react'
import { TextPadView } from '../src/tools/views/TextPadView'

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
    const { container } = render(<TextPadView />)
    expect(container.querySelector('[data-testid="text-pad-view"]')).not.toBeNull()
    expect(container.querySelector('.cm-editor')).not.toBeNull()
  })
})
