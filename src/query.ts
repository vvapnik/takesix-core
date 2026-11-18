import { MAX_BLOCKS_PER_LEVEL } from './constants.js'
import { buildIndex, type TreeIndex } from './tree-index.js'
import type { Block, TakeSixDocument } from './types.js'

export function findBlock(doc: TakeSixDocument, id: string, index: TreeIndex = buildIndex(doc)): Block | undefined {
  return index.get(id)?.block
}

/** Blocks from the top level down to `id`, inclusive. Empty if not found. Handy for breadcrumbs. */
export function getPath(doc: TakeSixDocument, id: string, index: TreeIndex = buildIndex(doc)): Block[] {
  const entry = index.get(id)
  if (!entry) return []
  return entry.path.map(pid => index.get(pid)!.block)
}

/** Blocks shown on the screen of `parentId` (`null` = top level). Empty if not found. */
export function getLevel(doc: TakeSixDocument, parentId: string | null, index: TreeIndex = buildIndex(doc)): Block[] {
  if (parentId === null) return doc.blocks
  return index.get(parentId)?.block.children ?? []
}

/** Whether one more block fits on the screen of `parentId`. */
export function canAddBlock(doc: TakeSixDocument, parentId: string | null, index: TreeIndex = buildIndex(doc)): boolean {
  if (parentId !== null && !index.has(parentId)) return false
  return getLevel(doc, parentId, index).length < MAX_BLOCKS_PER_LEVEL
}
