export function normalizeVisibleTabIds(
  openTabIds: string[],
  visibleTabIds: string[],
  capacity: number,
  activeTabId: string | null,
): string[] {
  const normalizedCapacity = Math.max(1, capacity)
  const openTabIdSet = new Set(openTabIds)
  const result: string[] = []

  for (const id of visibleTabIds) {
    if (openTabIdSet.has(id) && !result.includes(id) && result.length < normalizedCapacity) {
      result.push(id)
    }
  }

  for (const id of openTabIds) {
    if (result.length === normalizedCapacity) {
      break
    }

    if (!result.includes(id)) {
      result.push(id)
    }
  }

  if (activeTabId !== null && openTabIdSet.has(activeTabId) && !result.includes(activeTabId)) {
    result[result.length - 1] = activeTabId
  }

  return result
}

export function promoteOverflowTab(
  visibleTabIds: string[],
  selectedTabId: string,
): string[] {
  if (visibleTabIds.includes(selectedTabId)) {
    return visibleTabIds
  }

  return [...visibleTabIds.slice(0, -1), selectedTabId]
}
