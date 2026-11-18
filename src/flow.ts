import type { TreeIndex } from './tree-index.js'
import type { ValidationIssue } from './validate.js'

// Flowchart advice: checks that only make sense for blocks with a `shape`.
// Warnings only. Works on unvalidated input, so every value is checked
// before use.

type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/** Exits a condition may have: yes/no, or three for less/equal/greater. */
const MIN_EXITS = 2
const MAX_EXITS = 3

/** JSON Pointer of a block, from its path of ids. */
function pointer(path: string[], blocks: unknown[], index: TreeIndex): string {
  let p = '/blocks'
  let siblings = blocks
  path.forEach((id, depth) => {
    const block = index.get(id)!.block
    if (depth > 0) p += '/children'
    p += `/${siblings.indexOf(block)}`
    siblings = block.children ?? []
  })
  return p
}

/**
 * Warnings for flowchart blocks: a `decision` should have 2–3 exits on its
 * level, each with a `label` ("yes", "no"); a level should have at most one
 * start, a `terminator` nothing leads into.
 */
export function flowIssues(blocks: unknown[], links: unknown[], index: TreeIndex): ValidationIssue[] {
  const issues: ValidationIssue[] = []
  const edges = links.filter(isObject).flatMap(l => {
    const from = l.from
    const to = l.to
    if (typeof from !== 'string' || typeof to !== 'string' || from === to) return []
    const a = index.get(from)
    const b = index.get(to)
    // Only arrows on a level count: links across levels are never drawn
    if (!a || !b || a.parentId !== b.parentId) return []
    return [{ from, to, label: typeof l.label === 'string' ? l.label.trim() : '', both: l.direction === 'both' }]
  })

  const starts = new Map<string | null, string[]>()
  for (const [id, entry] of index) {
    const shape = (entry.block as unknown as Obj).shape
    if (shape === 'decision') {
      const exits = edges.filter(e => e.from === id || (e.both && e.to === id))
      const path = pointer(entry.path, blocks, index)
      if (exits.length < MIN_EXITS || exits.length > MAX_EXITS) {
        issues.push({
          severity: 'warning', code: 'decision-exits', path,
          message: `Decision "${id}" has ${exits.length} exit${exits.length === 1 ? '' : 's'}: ` +
            `a condition leads to ${MIN_EXITS} or ${MAX_EXITS} blocks on its level, one link each`,
        })
      }
      if (exits.some(e => e.label === '')) {
        issues.push({
          severity: 'warning', code: 'decision-exit-label', path,
          message: `Every exit of decision "${id}" needs a "label" saying when it is taken, like "yes" and "no"`,
        })
      }
    } else if (shape === 'terminator') {
      const entered = edges.some(e => e.to === id || (e.both && e.from === id))
      if (!entered) starts.set(entry.parentId, [...(starts.get(entry.parentId) ?? []), id])
    }
  }
  for (const [parentId, ids] of starts) {
    if (ids.length < 2) continue
    issues.push({
      severity: 'warning', code: 'several-starts',
      path: parentId === null ? '/blocks' : `${pointer(index.get(parentId)!.path, blocks, index)}/children`,
      message: `${ids.length} terminators start this level (${ids.map(i => `"${i}"`).join(', ')}): ` +
        'a flowchart has one start; link into the others or make them a different shape',
    })
  }
  return issues
}
