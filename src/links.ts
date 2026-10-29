import { buildIndex, type TreeIndex } from './tree-index.js'
import type { Link, LinkDirection, TakeSixDocument } from './types.js'

/** A link as drawn on one screen: between two blocks of that level. */
export interface VisibleLink {
  /** Stable key for rendering: `"<from>|<to>"`. */
  key: string
  from: string
  to: string
  direction: LinkDirection
  /** Every document link this arrow stands for. */
  links: Link[]
  /** `true` when all links connect exactly these two blocks, not their descendants. */
  direct: boolean
}

/**
 * Projects document links onto the screen of `parentId` (`null` = top level).
 *
 * Each endpoint is replaced by its ancestor on that level, so a link between
 * deeply nested blocks shows up as an arrow between the blocks that contain
 * them. Links whose endpoints land in the same block, or outside this level,
 * are not shown. Several links between the same pair of blocks merge into one
 * arrow.
 */
export function visibleLinks(
  doc: TakeSixDocument,
  parentId: string | null,
  index: TreeIndex = buildIndex(doc),
): VisibleLink[] {
  let depth = 0
  if (parentId !== null) {
    const parent = index.get(parentId)
    if (!parent) return []
    depth = parent.depth + 1
  }

  // Ancestor of `id` on this level, or undefined when `id` is outside it.
  const project = (id: string): string | undefined => {
    const entry = index.get(id)
    if (!entry) return undefined
    if (parentId !== null && entry.path[depth - 1] !== parentId) return undefined
    return entry.path[depth]
  }

  interface Group {
    a: string
    b: string
    /** Orientation of the first link, used for two-way and undirected arrows. */
    first: [string, string]
    links: Link[]
    forward: boolean
    backward: boolean
    both: boolean
    direct: boolean
  }
  const groups = new Map<string, Group>()

  for (const link of doc.links ?? []) {
    const from = project(link.from)
    const to = project(link.to)
    if (from === undefined || to === undefined || from === to) continue

    // Group by unordered pair, so a→b and b→a become one two-way arrow.
    const [a, b] = from < to ? [from, to] : [to, from]
    const key = `${a}|${b}`
    let g = groups.get(key)
    if (!g) {
      g = { a, b, first: [from, to], links: [], forward: false, backward: false, both: false, direct: true }
      groups.set(key, g)
    }
    g.links.push(link)
    const direction = link.direction ?? 'forward'
    if (direction === 'both') g.both = true
    else if (direction === 'forward') {
      if (from === a) g.forward = true
      else g.backward = true
    }
    if (link.from !== from || link.to !== to) g.direct = false
  }

  return [...groups.values()].map(g => {
    let [from, to] = g.first
    let direction: LinkDirection
    if (g.both || (g.forward && g.backward)) direction = 'both'
    else if (g.forward || g.backward) {
      direction = 'forward'
      ;[from, to] = g.forward ? [g.a, g.b] : [g.b, g.a]
    } else direction = 'none'
    return { key: `${from}|${to}`, from, to, direction, links: g.links, direct: g.direct }
  })
}
