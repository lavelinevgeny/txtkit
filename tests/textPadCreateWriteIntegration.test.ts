import { describe, expect, it, vi } from 'vitest'
import type { WriteResult } from '../src/tools/text-pad/types'

const mocks = vi.hoisted(() => ({ updateDocument: vi.fn(), waitForDocumentCreation: vi.fn() }))
vi.mock('../src/db/textPadRepository', () => ({ updateDocument: mocks.updateDocument }))
vi.mock('../src/tools/text-pad/useWorkspaceQueue', () => ({ waitForDocumentCreation: mocks.waitForDocumentCreation }))

import { enqueueDocumentWrite, resetDocumentWriteQueueForTests } from '../src/tools/text-pad/useDocumentWriteQueue'

describe('create then write integration', () => {
  it('waits for creation before writing newly typed content', async () => {
    resetDocumentWriteQueueForTests()
    let resolveCreation: () => void = () => {}
    mocks.waitForDocumentCreation.mockReturnValue(new Promise<void>((resolve) => { resolveCreation = resolve }))
    mocks.updateDocument.mockResolvedValue('written' as WriteResult)
    const result = enqueueDocumentWrite('new', { content: 'typed immediately', selection: null, scrollTop: 0, contentRevision: 1, updatedAt: 1 })
    await Promise.resolve()
    expect(mocks.updateDocument).not.toHaveBeenCalled()
    resolveCreation()
    await expect(result).resolves.toBe('written')
    expect(mocks.updateDocument).toHaveBeenCalledWith('new', expect.objectContaining({ content: 'typed immediately' }))
  })
})
