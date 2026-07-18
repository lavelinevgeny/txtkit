import type { DocumentContentPatch, WriteResult } from './types'
import { updateDocument } from '../../db/textPadRepository'
import { waitForDocumentCreation } from './useWorkspaceQueue'

interface QueuedWrite {
  patch: DocumentContentPatch
  waiters: Array<{
    resolve: (result: WriteResult) => void
    reject: (error: unknown) => void
  }>
}

const docWriteQueues = new Map<string, QueuedWrite[]>()

async function processQueue(id: string): Promise<void> {
  const queue = docWriteQueues.get(id)
  if (!queue) return

  while (queue.length > 0) {
    const write = queue[0]
    try {
      await waitForDocumentCreation(id)
      const result = await updateDocument(id, write.patch)
      for (const w of write.waiters) {
        w.resolve(result)
      }
    } catch (err) {
      for (const w of write.waiters) {
        w.reject(err)
      }
    }
    queue.shift()
  }
  docWriteQueues.delete(id)
}

export function resetDocumentWriteQueueForTests(): void {
  docWriteQueues.clear()
}

export function enqueueDocumentWrite(
  id: string,
  patch: DocumentContentPatch,
): Promise<WriteResult> {
  return new Promise<WriteResult>((resolve, reject) => {
    let queue = docWriteQueues.get(id)
    if (!queue) {
      queue = []
      docWriteQueues.set(id, queue)
    }

    const waiter = { resolve, reject }

    if (queue.length === 0) {
      queue.push({ patch, waiters: [waiter] })
      void processQueue(id)
    } else if (queue.length === 1) {
      queue.push({ patch, waiters: [waiter] })
    } else {
      const old = queue[1]
      for (const w of old.waiters) {
        w.resolve('superseded')
      }
      queue[1] = { patch, waiters: [waiter] }
    }
  })
}
