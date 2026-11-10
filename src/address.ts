import { buildIndex, type TreeIndex } from './tree-index.js'
import type { TakeSixDocument } from './types.js'

/**
 * A screen of a diagram, addressed by a block id (ids are permanent, so the
 * address survives edits that move the block):
 *
 * - `{ in: id }` — the screen inside the block;
 * - `{ at: id }` — the level the block lies on, with the block highlighted.
 *
 * `null` is the top level.
 */
export type ViewAddress = { in: string } | { at: string } | null

/** A view address resolved against a document. */
export interface ResolvedView {
  /** Ids of the opened blocks, from the top level down; empty for the top level. */
  path: string[]
  /** Block to highlight on that screen (`at` addresses). */
  highlight?: string
}

const IN = 'in'
const AT = 'at'

// The fragment as `key=value` pairs. Hand-rolled: the core has no DOM or
// Node types, so no URLSearchParams.
function splitHash(hash: string): [string, string][] {
  return hash.replace(/^#/, '').split('&').filter(Boolean).map(part => {
    const eq = part.indexOf('=')
    return eq === -1 ? [part, ''] : [part.slice(0, eq), part.slice(eq + 1)]
  })
}

function decode(value: string): string | undefined {
  try {
    return decodeURIComponent(value.replace(/\+/g, ' '))
  } catch {
    return undefined
  }
}

/**
 * Reads a view address from a URL fragment such as `location.hash`
 * (`#in=<id>` or `#at=<id>`; other keys such as `takesix=<data>` may sit
 * next to it, joined with `&`). `null` when the fragment holds none.
 */
export function parseViewAddress(hash: string): ViewAddress {
  const pairs = splitHash(hash)
  const get = (key: string) => decode(pairs.find(([k]) => k === key)?.[1] ?? '')
  const inside = get(IN)
  if (inside) return { in: inside }
  const at = get(AT)
  if (at) return { at }
  return null
}

/**
 * Writes a view address into a URL fragment, keeping its other keys. Returns
 * the fragment with a leading `#`, or `''` when nothing is left.
 */
export function formatViewAddress(view: ViewAddress, hash = ''): string {
  // Other keys stay exactly as they were (takesix=<data> is long)
  const parts = splitHash(hash).filter(([k]) => k !== IN && k !== AT).map(([k, v]) => `${k}=${v}`)
  if (view && 'in' in view) parts.push(`${IN}=${encodeURIComponent(view.in)}`)
  else if (view) parts.push(`${AT}=${encodeURIComponent(view.at)}`)
  return parts.length ? `#${parts.join('&')}` : ''
}

/** Whether two addresses point at the same screen and highlight. */
export function sameView(a: ViewAddress, b: ViewAddress): boolean {
  if (a === null || b === null) return a === b
  if ('in' in a) return 'in' in b && a.in === b.in
  return 'at' in b && a.at === b.at
}

/**
 * Turns an address into the path of opened blocks. An unknown id resolves to
 * the top level; `in` on a block that opens into nothing (no `children`, no
 * `details`) resolves like `at`.
 */
export function resolveView(doc: TakeSixDocument, view: ViewAddress, index: TreeIndex = buildIndex(doc)): ResolvedView {
  if (!view) return { path: [] }
  const id = 'in' in view ? view.in : view.at
  const entry = index.get(id)
  if (!entry) return { path: [] }
  const opens = entry.block.children !== undefined || entry.block.details !== undefined
  if ('in' in view && opens) return { path: entry.path }
  return { path: entry.path.slice(0, -1), highlight: id }
}

/** The address of a screen: the innermost opened block, or `null` for the top level. */
export function viewOfPath(path: readonly string[]): ViewAddress {
  const last = path[path.length - 1]
  return last === undefined ? null : { in: last }
}
