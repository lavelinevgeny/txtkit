import { beforeEach, describe, expect, it, vi } from 'vitest'
import { useTextPadStore } from '../src/tools/text-pad/useTextPadStore'
import { enqueueWorkspaceMutation, resetWorkspaceQueueForTests, waitForDocumentCreation } from '../src/tools/text-pad/useWorkspaceQueue'
import type { DocumentRecord, WorkspaceRecord } from '../src/tools/text-pad/types'

vi.mock('../src/db/textPadRepository', () => ({ commitWorkspace: vi.fn() }))
import { commitWorkspace } from '../src/db/textPadRepository'

const mockedCommit = vi.mocked(commitWorkspace)
const workspace = (): WorkspaceRecord => ({ key: 'current', activeTabId: 'a', openTabIds: ['a'], nextUntitledNumber: 2, migrations: { legacyLocalStorageMigrationCompleted: true } })
const document = (id: string): DocumentRecord => ({ id, title: 'pad1', content: '', selection: null, scrollTop: 0, contentRevision: 0, createdAt: 1, updatedAt: 1 })

beforeEach(() => {
  resetWorkspaceQueueForTests(); mockedCommit.mockReset()
  useTextPadStore.setState({ activeTabId: 'a', openTabIds: ['a'], tabsById: { a: { title: 'pad1' } }, nextUntitledNumber: 2, persistenceStatus: 'ready', currentRevisionById: {}, savedRevisionById: {}, saveErrorById: {}, workspaceSaveError: false })
})

describe('workspace queue', () => {
  it('resolves creation only after its commit succeeds', async () => {
    let resolveCommit: () => void = () => {}
    mockedCommit.mockImplementation(() => new Promise<void>((resolve) => { resolveCommit = resolve }))
    const operation = enqueueWorkspaceMutation({ workspace: workspace(), putDocuments: [document('new')], createdDocumentIds: ['new'] })
    const creation = waitForDocumentCreation('new')
    await Promise.resolve()
    resolveCommit()
    await operation
    await expect(creation).resolves.toBeUndefined()
  })

  it('rejects creation and switches to memory-only after structural failure', async () => {
    mockedCommit.mockRejectedValue(new Error('quota'))
    const operation = enqueueWorkspaceMutation({ workspace: workspace(), putDocuments: [document('new')], createdDocumentIds: ['new'] })
    const creation = waitForDocumentCreation('new')
    await expect(operation).rejects.toThrow('quota')
    await expect(creation).rejects.toThrow('quota')
    expect(useTextPadStore.getState().persistenceStatus).toBe('memory-only')
  })

  it('serializes mutations and treats ordinary snapshots as retryable', async () => {
    const order: number[] = []
    mockedCommit.mockImplementationOnce(async () => { order.push(1) }).mockImplementationOnce(async () => { order.push(2) })
    await Promise.all([enqueueWorkspaceMutation({ workspace: workspace() }), enqueueWorkspaceMutation({ workspace: workspace() })])
    expect(order).toEqual([1, 2])
    mockedCommit.mockRejectedValueOnce(new Error('temporary'))
    await expect(enqueueWorkspaceMutation({ workspace: workspace(), putDocuments: [document('a')], createdDocumentIds: [] })).rejects.toThrow('temporary')
    expect(useTextPadStore.getState().persistenceStatus).toBe('save-error')
  })

  it('rejects inconsistent created document ids', async () => {
    await expect(enqueueWorkspaceMutation({ workspace: workspace(), putDocuments: [], createdDocumentIds: ['missing'] })).rejects.toThrow('does not include it')
  })
})
