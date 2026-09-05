import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { I18nProvider } from '../src/i18n/context'
import { useStore } from '../src/store/useStore'
import MermaidView from '../src/tools/views/MermaidView'

const RENDERED_SVG =
  '<svg id="mermaid-1" viewBox="0 0 320 180" width="100%"><g><text>A</text></g></svg>'

const initialize = vi.fn()
const renderDiagram = vi.fn(async () => ({ svg: RENDERED_SVG }))

vi.mock('mermaid', () => ({
  default: {
    initialize: (...args: unknown[]) => initialize(...args),
    render: (...args: unknown[]) => renderDiagram(...args),
  },
}))

function renderMermaid() {
  return render(
    <I18nProvider>
      <MermaidView />
    </I18nProvider>,
  )
}

const DIAGRAM = 'graph TD\n  A --> B'

beforeEach(() => {
  initialize.mockClear()
  renderDiagram.mockClear()
  useStore.setState({ input: '', activeToolId: 'mermaid', locale: 'en' })
})

describe('MermaidView toolbar', () => {
  it('disables the zoom group and the export buttons without a rendered diagram', () => {
    renderMermaid()

    for (const name of ['Zoom out', 'Zoom in', 'Reset zoom', 'Copy PNG', 'Download PNG', 'Download SVG', 'Copy SVG']) {
      expect(screen.getByRole('button', { name }), name).toBeDisabled()
    }
    expect(screen.getByTestId('mermaid-zoom-level')).toHaveTextContent('100%')
  })

  it('renders mermaid with htmlLabels disabled so PNG export keeps node text', async () => {
    useStore.setState({ input: DIAGRAM })
    const { container } = renderMermaid()

    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())
    expect(initialize).toHaveBeenCalledWith(
      expect.objectContaining({ htmlLabels: false }),
    )
  })

  it('zooms in with + and returns to 100% with the reset button', async () => {
    useStore.setState({ input: DIAGRAM })
    renderMermaid()

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Zoom in' })).toBeEnabled(),
    )

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByTestId('mermaid-zoom-level')).toHaveTextContent('125%')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(screen.getByTestId('mermaid-zoom-level')).toHaveTextContent('150%')

    fireEvent.click(screen.getByRole('button', { name: 'Reset zoom' }))
    expect(screen.getByTestId('mermaid-zoom-level')).toHaveTextContent('100%')
  })

  it('ignores the wheel until a diagram is rendered', () => {
    renderMermaid()

    const viewport = screen.getByTestId('mermaid-preview')
    const event = new WheelEvent('wheel', {
      deltaY: -240,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    })
    fireEvent(viewport, event)

    expect(screen.getByTestId('mermaid-zoom-level')).toHaveTextContent('100%')
    expect(event.defaultPrevented).toBe(false)
  })

  it('zooms towards the cursor on wheel once a diagram is rendered', async () => {
    useStore.setState({ input: DIAGRAM })
    const { container } = renderMermaid()

    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())

    const viewport = screen.getByTestId('mermaid-preview')
    const event = new WheelEvent('wheel', {
      deltaY: -240,
      clientX: 50,
      clientY: 50,
      bubbles: true,
      cancelable: true,
    })
    fireEvent(viewport, event)

    expect(screen.getByTestId('mermaid-zoom-level')).toHaveTextContent('143%')
    expect(event.defaultPrevented).toBe(true)
  })

  it('names the zoom indicator with its current value for screen readers', () => {
    renderMermaid()

    expect(screen.getByRole('img', { name: 'Zoom level: 100%' })).toBe(
      screen.getByTestId('mermaid-zoom-level'),
    )
  })

  it('applies an inline transform with the current scale to the diagram wrapper', async () => {
    useStore.setState({ input: DIAGRAM })
    const { container } = renderMermaid()

    await waitFor(() => expect(container.querySelector('.mermaid-svg')).not.toBeNull())

    const wrapper = container.querySelector('.mermaid-svg') as HTMLElement
    expect(wrapper.style.transform).toContain('scale(1)')

    fireEvent.click(screen.getByRole('button', { name: 'Zoom in' }))
    expect(wrapper.style.transform).toContain('scale(1.25)')
    expect(wrapper.style.transform).toContain('translate(0px, 0px)')
  })
})
