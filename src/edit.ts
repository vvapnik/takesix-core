import { FORMAT_VERSION, MAX_BLOCKS_PER_LEVEL } from './constants.js'
import { TakeSixError } from './errors.js'
import { createId } from './id.js'
import { buildIndex } from './tree-index.js'
import type { Block, Link, TakeSixDocument } from './types.js'

// All helpers are immutable: they return a new document and share untouched
// subtrees with the old one, so they work as React state updates.

/** Editable block fields. A key set to `undefined` removes that field. */
export type BlockChanges = Partial<Omit<Block, 'id' | 'children'>>

/** Editable link fields. A key set to `undefined` removes that field. */
export type LinkChanges = Partial<Omit<Link, 'id'>>

export type NewBlock = Omit<Block, 'id'> & { id?: string }
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

/** Replaces the child list of `parentId` (`null` = top level). */
function updateLevel(doc: TakeSixDocument, parentId: string | null, fn: (blocks: Block[]) => Block[]): TakeSixDocument {
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

function insertAt<T>(list: T[], item: T, index?: number): T[] {
  const at = index === undefined ? list.length : Math.max(0, Math.min(index, list.length))
  return [...list.slice(0, at), item, ...list.slice(at)]
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
  { index }: { index?: number } = {},
): { document: TakeSixDocument; block: Block } {
  const tree = buildIndex(doc)
  if (parentId !== null && !tree.has(parentId)) throw new TakeSixError('not-found', `No block with id "${parentId}"`)
  const block: Block = { ...input, id: input.id ?? createId() }
  for (const id of subtreeIds(block)) {
    if (tree.has(id)) throw new TakeSixError('duplicate-id', `Id "${id}" is already used`)
  }
  const document = updateLevel(doc, parentId, blocks => {
    checkRoom(blocks.length + 1, parentId)
    return insertAt(blocks, block, index)
  })
  return { document, block }
}

export function updateBlock(doc: TakeSixDocument, id: string, changes: BlockChanges): TakeSixDocument {
  const { parentId } = requireBlock(doc, id)
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

/** Moves a block (with its subtree) under `parentId`, optionally at `index`. Links are kept. */
export function moveBlock(
  doc: TakeSixDocument,
  id: string,
  parentId: string | null,
  { index }: { index?: number } = {},
): TakeSixDocument {
  const tree = buildIndex(doc)
  const entry = tree.get(id)
  if (!entry) throw new TakeSixError('not-found', `No block with id "${id}"`)
  if (parentId !== null) {
    const target = tree.get(parentId)
    if (!target) throw new TakeSixError('not-found', `No block with id "${parentId}"`)
    if (target.path.includes(id)) throw new TakeSixError('invalid-move', `Cannot move block "${id}" into itself`)
  }
  const removed = updateLevel(doc, entry.parentId, blocks => blocks.filter(b => b.id !== id))
  return updateLevel(removed, parentId, blocks => {
    checkRoom(blocks.length + 1, parentId)
    return insertAt(blocks, entry.block, index)
  })
}

/**
 * Wraps sibling blocks into a new parent block placed where the first of
 * them was. The usual fix when a level outgrows six blocks.
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
    const members = blocks.filter(b => selected.has(b.id))
    group = { ...input, id: groupId, children: members }
    const at = blocks.findIndex(b => selected.has(b.id))
    return insertAt(blocks.filter(b => !selected.has(b.id)), group, at)
  })
  return { document, block: group! }
}

/**
 * Replaces a block with its children (the inverse of {@link groupBlocks}).
 * Links attached to the block itself are removed.
 */
export function ungroupBlock(doc: TakeSixDocument, id: string): TakeSixDocument {
  const { parentId, block } = requireBlock(doc, id)
  const children = block.children ?? []
  const next = updateLevel(doc, parentId, blocks => {
    checkRoom(blocks.length - 1 + children.length, parentId)
    const at = blocks.findIndex(b => b.id === id)
    return [...blocks.slice(0, at), ...children, ...blocks.slice(at + 1)]
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
