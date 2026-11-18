import { buildIndex, type TreeIndex } from './tree-index.js'
import type { Link, LinkDirection, LinkStyle, TakeSixDocument } from './types.js'

/** A link as drawn on one screen: between two blocks of that level. */
export interface VisibleLink {
  /** Stable key for rendering: `"<from>|<to>"`. */
  key: string
  from: string
  to: string
  direction: LinkDirection
  /** The links' common style, `'solid'` when they differ. */
  style: LinkStyle
  /** Every document link this arrow stands for. */
  links: Link[]
}

/**
 * The arrows on the screen of `parentId` (`null` = top level): links between
 * two blocks of that level. Links between blocks of different levels are
 * never drawn. Several links between the same pair of blocks merge into one
 * arrow, opposite one-way links into a two-way arrow.
 */
export function visibleLinks(
  doc: TakeSixDocument,
  parentId: string | null,
  index: TreeIndex = buildIndex(doc),
): VisibleLink[] {
  if (parentId !== null && !index.has(parentId)) return []
  const onLevel = (id: string) => {
    const entry = index.get(id)
    return entry !== undefined && entry.parentId === parentId
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
  }
  const groups = new Map<string, Group>()

  for (const link of doc.links ?? []) {
    const { from, to } = link
    if (from === to || !onLevel(from) || !onLevel(to)) continue

    // Group by unordered pair, so a→b and b→a become one two-way arrow.
    const [a, b] = from < to ? [from, to] : [to, from]
    const key = `${a}|${b}`
    let g = groups.get(key)
    if (!g) {
      g = { a, b, first: [from, to], links: [], forward: false, backward: false, both: false }
      groups.set(key, g)
    }
    g.links.push(link)
    const direction = link.direction ?? 'forward'
    if (direction === 'both') g.both = true
    else if (direction === 'forward') {
      if (from === a) g.forward = true
      else g.backward = true
    }
  }

  return [...groups.values()].map(g => {
    let [from, to] = g.first
    let direction: LinkDirection
    if (g.both || (g.forward && g.backward)) direction = 'both'
    else if (g.forward || g.backward) {
      direction = 'forward'
      ;[from, to] = g.forward ? [g.a, g.b] : [g.b, g.a]
    } else direction = 'none'
    const styles = new Set<LinkStyle>(g.links.map(l => l.style ?? 'solid'))
    const style: LinkStyle = styles.size === 1 ? [...styles][0]! : 'solid'
    return { key: `${from}|${to}`, from, to, direction, style, links: g.links }
  })
}
