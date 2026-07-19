import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { WriteResult } from '../src/tools/text-pad/types'

vi.mock('../src/db/textPadRepository', () => ({ updateDocument: vi.fn() }))
vi.mock('../src/tools/text-pad/useWorkspaceQueue', () => ({ waitForDocumentCreation: vi.fn(() => Promise.resolve()) }))

import { updateDocument } from '../src/db/textPadRepository'
import { enqueueDocumentWrite, resetDocumentWriteQueueForTests } from '../src/tools/text-pad/useDocumentWriteQueue'

const mockedUpdate = vi.mocked(updateDocument)
const patch = (content: string) => ({ content, selection: null, scrollTop: 0, contentRevision: 1, updatedAt: 1 })

beforeEach(() => { mockedUpdate.mockReset(); resetDocumentWriteQueueForTests() })

describe('document write queue', () => {
  it('serializes writes for the same document', async () => {
    mockedUpdate.mockResolvedValue('written')
    await expect(Promise.all([enqueueDocumentWrite('a', patch('one')), enqueueDocumentWrite('a', patch('two'))])).resolves.toEqual(['written', 'written'])
    expect(mockedUpdate).toHaveBeenCalledTimes(2)
  })

  it('supersedes the middle queued write', async () => {
    let resolveFirst: (value: WriteResult) => void = () => {}
    mockedUpdate.mockImplementationOnce(() => new Promise<WriteResult>((resolve) => { resolveFirst = resolve }))
    mockedUpdate.mockResolvedValueOnce('written')
    const first = enqueueDocumentWrite('a', patch('one'))
    const second = enqueueDocumentWrite('a', patch('two'))
    const third = enqueueDocumentWrite('a', patch('three'))
    await Promise.resolve()
    resolveFirst('written')
    await expect(first).resolves.toBe('written')
    await expect(second).resolves.toBe('superseded')
    await expect(third).resolves.toBe('written')
    expect(mockedUpdate).toHaveBeenLastCalledWith('a', expect.objectContaining({ content: 'three' }))
  })
})
