import { diffLines, diffWordsWithSpace, type DiffLinesOptionsNonabortable } from 'diff'

export type DiffOp = 'equal' | 'add' | 'remove' | 'replace'

/** A piece of a line; `changed` marks the intra-line word-level difference. */
export interface DiffSeg {
  text: string
  changed: boolean
}

/**
 * One aligned row of the side-by-side diff. `left`/`right` hold the segments of
 * the corresponding pane, or `null` when that pane has no line for this row
 * (a gap opposite an add/remove).
 */
export interface DiffRow {
  op: DiffOp
  left: DiffSeg[] | null
  right: DiffSeg[] | null
}

export interface DiffOptions {
  ignoreCase?: boolean
  ignoreWhitespace?: boolean
  /** Highlight changed words inside replaced lines. */
  wordLevel?: boolean
}

export interface DiffStats {
  added: number
  removed: number
  changed: number
  /** Contiguous runs of non-equal rows — matches "N differences found". */
  blocks: number
}

function stripTrailingNewline(value: string): string {
  return value.endsWith('\n') ? value.slice(0, -1) : value
}

/** Split a line-token change (possibly multi-line) into individual lines. */
function toLines(value: string): string[] {
  return stripTrailingNewline(value).split('\n')
}

function plainSegs(line: string): DiffSeg[] {
  return [{ text: line, changed: false }]
}

/** Build word-level segments for a replaced pair of lines. */
function wordSegs(
  left: string,
  right: string,
  opts: DiffOptions,
): { left: DiffSeg[]; right: DiffSeg[] } {
  if (!opts.wordLevel) {
    return { left: plainSegs(left), right: plainSegs(right) }
  }
  const parts = diffWordsWithSpace(left, right, { ignoreCase: opts.ignoreCase })
  const leftSegs: DiffSeg[] = []
  const rightSegs: DiffSeg[] = []
  for (const part of parts) {
    if (part.added) {
      rightSegs.push({ text: part.value, changed: true })
    } else if (part.removed) {
      leftSegs.push({ text: part.value, changed: true })
    } else {
      leftSegs.push({ text: part.value, changed: false })
      rightSegs.push({ text: part.value, changed: false })
    }
  }
  return {
    left: leftSegs.length > 0 ? leftSegs : plainSegs(left),
    right: rightSegs.length > 0 ? rightSegs : plainSegs(right),
  }
}

/** Pair buffered removed/added lines into replace/remove/add rows. */
function flushBuffers(removed: string[], added: string[], opts: DiffOptions): DiffRow[] {
  const rows: DiffRow[] = []
  const max = Math.max(removed.length, added.length)
  for (let i = 0; i < max; i++) {
    const l = i < removed.length ? removed[i] : null
    const r = i < added.length ? added[i] : null
    if (l !== null && r !== null) {
      const segs = wordSegs(l, r, opts)
      rows.push({ op: 'replace', left: segs.left, right: segs.right })
    } else if (l !== null) {
      rows.push({ op: 'remove', left: plainSegs(l), right: null })
    } else if (r !== null) {
      rows.push({ op: 'add', left: null, right: plainSegs(r) })
    }
  }
  return rows
}

/**
 * Compute an aligned, side-by-side line diff of two texts. Returns one
 * {@link DiffRow} per visual row of the comparison.
 */
export function diffRows(a: string, b: string, opts: DiffOptions = {}): DiffRow[] {
  if (a === '' && b === '') return []

  // diffLines tokenises each line together with its trailing newline, so a
  // last line without a newline never matches an identical interior line.
  // Normalise both sides to end with exactly one newline to align tokens.
  const na = a === '' || a.endsWith('\n') ? a : a + '\n'
  const nb = b === '' || b.endsWith('\n') ? b : b + '\n'

  // `ignoreCase` is honoured by the diff engine for lines too, but the v9
  // types only declare it on char/word diffs — widen the option type here.
  const lineOptions: DiffLinesOptionsNonabortable & { ignoreCase?: boolean } = {
    oneChangePerToken: true,
    ignoreCase: opts.ignoreCase,
    ignoreWhitespace: opts.ignoreWhitespace,
  }
  const changes = diffLines(na, nb, lineOptions)

  const rows: DiffRow[] = []
  let removed: string[] = []
  let added: string[] = []

  for (const change of changes) {
    const lines = toLines(change.value)
    if (change.added) {
      added.push(...lines)
    } else if (change.removed) {
      removed.push(...lines)
    } else {
      rows.push(...flushBuffers(removed, added, opts))
      removed = []
      added = []
      for (const line of lines) {
        rows.push({ op: 'equal', left: plainSegs(line), right: plainSegs(line) })
      }
    }
  }
  rows.push(...flushBuffers(removed, added, opts))

  return rows
}

export function diffStats(rows: DiffRow[]): DiffStats {
  let added = 0
  let removed = 0
  let changed = 0
  let blocks = 0
  let inBlock = false

  for (const row of rows) {
    if (row.op === 'equal') {
      inBlock = false
      continue
    }
    if (row.op === 'add') added++
    else if (row.op === 'remove') removed++
    else changed++
    if (!inBlock) {
      blocks++
      inBlock = true
    }
  }

  return { added, removed, changed, blocks }
}
