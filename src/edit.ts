import { FORMAT_VERSION, MAX_BLOCKS_PER_LEVEL } from './constants.js'
import { TakeSixError } from './errors.js'
import { findPlace, fitsGrid, formatArea, levelAreas, overlap, parseArea, readArea, readingOrder, type Area } from './grid.js'
import { createId } from './id.js'
import { buildIndex } from './tree-index.js'
import type { Block, Link, TakeSixDocument } from './types.js'

// All helpers are immutable: they return a new document and share untouched
// subtrees with the old one, so they work as React state updates.

/** Editable block fields. A key set to `undefined` removes that field. */
export type BlockChanges = Partial<Omit<Block, 'id' | 'children'>>

/** Editable link fields. A key set to `undefined` removes that field. */
export type LinkChanges = Partial<Omit<Link, 'id'>>

/** A block to add. Without `at` it goes to the first free place on its level. */
export type NewBlock = Omit<Block, 'id' | 'at'> & { id?: string; at?: string }
export type NewLink = Omit<Link, 'id'> & { id?: string }

export function createDocument(init: Partial<Omit<TakeSixDocument, 'takesix'>> = {}): TakeSixDocument {
  return { ...init, takesix: FORMAT_VERSION, title: init.title ?? 'Untitled', blocks: init.blocks ?? [] }
}

function applyChanges<T extends object>(target: T, changes: object): T {
  const next = { ...target } as Record<string, unknown>
  for (const [key, value] of Object.entries(changes)) {
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return next as T
}

function setChildren(block: Block, children: Block[]): Block {
  const { children: _, ...rest } = block
  return children.length ? { ...rest, children } : rest
}

/**
 * Replaces the child list of `parentId` (`null` = top level). The new list
 * is kept in reading order, so files stay easy to read top to bottom.
 */
function updateLevel(doc: TakeSixDocument, parentId: string | null, update: (blocks: Block[]) => Block[]): TakeSixDocument {
  const fn = (blocks: Block[]) => readingOrder(update(blocks))
  if (parentId === null) return { ...doc, blocks: fn(doc.blocks) }
  let found = false
  const walk = (blocks: Block[]): Block[] =>
    blocks.map(b => {
      if (found) return b
      if (b.id === parentId) {
        found = true
        return setChildren(b, fn(b.children ?? []))
      }
      if (!b.children?.length) return b
      const children = walk(b.children)
      return children.some((c, i) => c !== b.children![i]) ? { ...b, children } : b
    })
  const blocks = walk(doc.blocks)
  if (!found) throw new TakeSixError('not-found', `No block with id "${parentId}"`)
  return { ...doc, blocks }
}

function requireBlock(doc: TakeSixDocument, id: string) {
  const entry = buildIndex(doc).get(id)
  if (!entry) throw new TakeSixError('not-found', `No block with id "${id}"`)
  return entry
}

function checkRoom(count: number, parentId: string | null) {
  if (count > MAX_BLOCKS_PER_LEVEL) {
    const where = parentId === null ? 'the top level' : `block "${parentId}"`
    throw new TakeSixError('too-many-blocks', `${where} would have ${count} blocks, at most ${MAX_BLOCKS_PER_LEVEL} allowed`)
  }
}

/** Width of a new block placed automatically: half the grid. */
const NEW_BLOCK_WIDTH = 3

function requireArea(at: string): Area {
  const area = readArea(at)
  if (typeof area === 'string') throw new TakeSixError('invalid-area', area)
  return area
}

/** Returns `area` if none of `taken` overlaps it. */
function checkFree(taken: Area[], area: Area): Area {
  for (const t of taken) {
    const cell = overlap(t, area)
    if (cell) throw new TakeSixError('overlap', `${formatArea(area)} overlaps another block at ${cell}`)
  }
  return area
}

/**
 * First free place for a `width` × `height` block. When the grid has no room
 * for that size, tries one row of the same width, then narrower rows.
 */
function autoPlace(taken: Area[], width: number, height: number): Area {
  const tries: Array<[number, number]> = [[width, height]]
  for (let w = width; w >= 1; w--) tries.push([w, 1])
  for (const [w, h] of tries) {
    const area = findPlace(taken, w, h)
    if (area) return area
  }
  throw new TakeSixError('no-room', 'No free cell left on the grid of this level')
}

/** The block's own place when it is free, else the first free place for its size. */
function keepOrPlace(taken: Area[], at: string): Area {
  const area = parseArea(at)
  if (area && taken.every(t => !overlap(t, area))) return area
  return autoPlace(taken, area?.width ?? NEW_BLOCK_WIDTH, area?.height ?? 1)
}

/** The smallest area covering all `areas`, or `undefined` for none. */
function bounds(areas: Area[]): Area | undefined {
  if (!areas.length) return undefined
  const col = Math.min(...areas.map(a => a.col))
  const row = Math.min(...areas.map(a => a.row))
  const right = Math.max(...areas.map(a => a.col + a.width))
  const bottom = Math.max(...areas.map(a => a.row + a.height))
  return { col, row, width: right - col, height: bottom - row }
}

/** Collects the ids of a block and all its descendants. */
function subtreeIds(block: Block, out = new Set<string>()): Set<string> {
  out.add(block.id)
  for (const c of block.children ?? []) subtreeIds(c, out)
  return out
}

function withLinks(doc: TakeSixDocument, links: Link[]): TakeSixDocument {
  const { links: _, ...rest } = doc
  return links.length ? { ...rest, links } : rest
}

// ── Blocks ────────────────────────────────────────────────────────────────

export function addBlock(
  doc: TakeSixDocument,
  parentId: string | null,
  input: NewBlock,
): { document: TakeSixDocument; block: Block } {
  const tree = buildIndex(doc)
  if (parentId !== null && !tree.has(parentId)) throw new TakeSixError('not-found', `No block with id "${parentId}"`)
  const { at, ...fields } = input
  const id = input.id ?? createId()
  let block: Block | undefined
  const document = updateLevel(doc, parentId, blocks => {
    checkRoom(blocks.length + 1, parentId)
    const taken = [...levelAreas(blocks).values()]
    const area = at === undefined ? autoPlace(taken, NEW_BLOCK_WIDTH, 1) : checkFree(taken, requireArea(at))
    block = { ...fields, id, at: formatArea(area) }
    return [...blocks, block]
  })
  for (const sub of subtreeIds(block!)) {
    if (tree.has(sub)) throw new TakeSixError('duplicate-id', `Id "${sub}" is already used`)
  }
  return { document, block: block! }
}

/** Changes block fields. A new `at` must be free on the block's level. */
export function updateBlock(doc: TakeSixDocument, id: string, changes: BlockChanges): TakeSixDocument {
  const { parentId } = requireBlock(doc, id)
  if ('at' in changes) {
    if (changes.at === undefined) throw new TakeSixError('invalid-area', 'A block cannot lose its "at"')
    const area = requireArea(changes.at)
    return updateLevel(doc, parentId, blocks => {
      checkFree([...levelAreas(blocks.filter(b => b.id !== id)).values()], area)
      return blocks.map(b => (b.id === id ? applyChanges(b, { ...changes, at: formatArea(area) }) : b))
    })
  }
  return updateLevel(doc, parentId, blocks => blocks.map(b => (b.id === id ? applyChanges(b, changes) : b)))
}

/** Removes a block with its whole subtree, and every link touching any of them. */
export function removeBlock(doc: TakeSixDocument, id: string): TakeSixDocument {
  const { parentId, block } = requireBlock(doc, id)
  const removed = subtreeIds(block)
  const next = updateLevel(doc, parentId, blocks => blocks.filter(b => b.id !== id))
  if (!doc.links) return next
  return withLinks(next, doc.links.filter(l => !removed.has(l.from) && !removed.has(l.to)))
}

/**
 * Moves a block (with its subtree) under `parentId` (`null` = top level),
 * to `at` when given. Without `at` the block keeps its place if that is free
 * on the new level, and otherwise goes to the first free place. Links are kept.
 */
export function moveBlock(
  doc: TakeSixDocument,
  id: string,
  parentId: string | null,
  { at }: { at?: string } = {},
): TakeSixDocument {
  const tree = buildIndex(doc)
  const entry = tree.get(id)
  if (!entry) throw new TakeSixError('not-found', `No block with id "${id}"`)
  if (parentId !== null) {
    const target = tree.get(parentId)
    if (!target) throw new TakeSixError('not-found', `No block with id "${parentId}"`)
    if (target.path.includes(id)) throw new TakeSixError('invalid-move', `Cannot move block "${id}" into itself`)
  }
  if (parentId === entry.parentId) return at === undefined ? doc : updateBlock(doc, id, { at })
  const removed = updateLevel(doc, entry.parentId, blocks => blocks.filter(b => b.id !== id))
  return updateLevel(removed, parentId, blocks => {
    checkRoom(blocks.length + 1, parentId)
    const taken = [...levelAreas(blocks).values()]
    const area = at === undefined ? keepOrPlace(taken, entry.block.at) : checkFree(taken, requireArea(at))
    return [...blocks, { ...entry.block, at: formatArea(area) }]
  })
}

/**
 * Wraps sibling blocks into a new parent block. The usual fix when a level
 * outgrows six blocks. The group covers the rectangle around its members
 * when no other block is in the way, and otherwise takes the place of the
 * first member; `input.at` overrides both. Inside the group the members keep
 * their arrangement, moved to the top-left corner.
 */
export function groupBlocks(
  doc: TakeSixDocument,
  ids: string[],
  input: NewBlock,
): { document: TakeSixDocument; block: Block } {
  if (ids.length === 0) throw new TakeSixError('invalid-move', 'Nothing to group')
  const tree = buildIndex(doc)
  const entries = ids.map(id => {
    const e = tree.get(id)
    if (!e) throw new TakeSixError('not-found', `No block with id "${id}"`)
    return e
  })
  const parentId = entries[0]!.parentId
  if (entries.some(e => e.parentId !== parentId)) {
    throw new TakeSixError('invalid-move', 'Only blocks on the same level can be grouped')
  }
  if (input.children?.length) throw new TakeSixError('invalid-move', 'The group block gets its children from `ids`')
  const groupId = input.id ?? createId()
  if (tree.has(groupId)) throw new TakeSixError('duplicate-id', `Id "${groupId}" is already used`)
  checkRoom(ids.length, groupId)

  const selected = new Set(ids)
  let group: Block | undefined
  const document = updateLevel(doc, parentId, blocks => {
    const members = readingOrder(blocks.filter(b => selected.has(b.id)))
    const rest = blocks.filter(b => !selected.has(b.id))
    const taken = [...levelAreas(rest).values()]
    const areas = [...levelAreas(members).values()]
    const box = bounds(areas)
    let area: Area
    if (input.at !== undefined) area = checkFree(taken, requireArea(input.at))
    else if (box && taken.every(t => !overlap(t, box))) area = box
    else area = areas[0] ?? autoPlace(taken, NEW_BLOCK_WIDTH, 1)
    const children = box
      ? members.map(m => {
          const a = parseArea(m.at)
          return a ? { ...m, at: formatArea({ ...a, col: a.col - box.col, row: a.row - box.row }) } : m
        })
      : members
    group = { ...input, id: groupId, at: formatArea(area), children }
    return [...rest, group]
  })
  return { document, block: group! }
}

/**
 * Replaces a block with its children (the inverse of {@link groupBlocks}).
 * The children keep their arrangement, moved to where the block was; a child
 * that does not fit there goes to the first free place. Links attached to
 * the block itself are removed.
 */
export function ungroupBlock(doc: TakeSixDocument, id: string): TakeSixDocument {
  const { parentId, block } = requireBlock(doc, id)
  const children = readingOrder(block.children ?? [])
  const origin = parseArea(block.at) ?? { col: 0, row: 0, width: 1, height: 1 }
  const next = updateLevel(doc, parentId, blocks => {
    checkRoom(blocks.length - 1 + children.length, parentId)
    const rest = blocks.filter(b => b.id !== id)
    const taken = [...levelAreas(rest).values()]
    const placed = children.map(child => {
      const a = parseArea(child.at)
      const shifted = a && { ...a, col: a.col + origin.col, row: a.row + origin.row }
      const area = shifted && fitsGrid(shifted) && taken.every(t => !overlap(t, shifted))
        ? shifted
        : autoPlace(taken, a?.width ?? NEW_BLOCK_WIDTH, a?.height ?? 1)
      taken.push(area)
      return { ...child, at: formatArea(area) }
    })
    return [...rest, ...placed]
  })
  if (!doc.links) return next
  return withLinks(next, doc.links.filter(l => l.from !== id && l.to !== id))
}

// ── Links ─────────────────────────────────────────────────────────────────

export function addLink(doc: TakeSixDocument, input: NewLink): { document: TakeSixDocument; link: Link } {
  const tree = buildIndex(doc)
  const from = tree.get(input.from)
  const to = tree.get(input.to)
  if (!from) throw new TakeSixError('not-found', `No block with id "${input.from}"`)
  if (!to) throw new TakeSixError('not-found', `No block with id "${input.to}"`)
  if (input.from === input.to) throw new TakeSixError('invalid-link', 'A block cannot link to itself')
  if (from.path.includes(input.to) || to.path.includes(input.from)) {
    throw new TakeSixError('invalid-link', 'A block cannot link to its own ancestor or descendant')
  }
  const links = doc.links ?? []
  const link: Link = { ...input, id: input.id ?? createId('l') }
  if (links.some(l => l.id === link.id)) throw new TakeSixError('duplicate-id', `Link id "${link.id}" is already used`)
  return { document: withLinks(doc, [...links, link]), link }
}

export function updateLink(doc: TakeSixDocument, id: string, changes: LinkChanges): TakeSixDocument {
  const links = doc.links ?? []
  const current = links.find(l => l.id === id)
  if (!current) throw new TakeSixError('not-found', `No link with id "${id}"`)
  const updated = applyChanges(current, changes)
  if (updated.from !== current.from || updated.to !== current.to) {
    // Re-run endpoint checks against the document without the old link.
    const { from, to, ...rest } = updated
    addLink(withLinks(doc, links.filter(l => l !== current)), { ...rest, from, to })
  }
  return withLinks(doc, links.map(l => (l === current ? updated : l)))
}

export function removeLink(doc: TakeSixDocument, id: string): TakeSixDocument {
  const links = doc.links ?? []
  if (!links.some(l => l.id === id)) throw new TakeSixError('not-found', `No link with id "${id}"`)
  return withLinks(doc, links.filter(l => l.id !== id))
}
