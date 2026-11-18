import type { Block, TakeSixDocument } from './types.js'

export interface IndexEntry {
  block: Block
  /** `null` for top-level blocks. */
  parentId: string | null
  /** Ids from the top level down to and including this block. */
  path: string[]
  /** 0 for top-level blocks. */
  depth: number
}

export type TreeIndex = Map<string, IndexEntry>

/**
 * Builds an id → position lookup for a document. On duplicate ids the first
 * occurrence wins; {@link validateDocument} reports the duplicates.
 */
export function buildIndex(doc: TakeSixDocument): TreeIndex {
  const index: TreeIndex = new Map()
  const walk = (blocks: Block[], parentId: string | null, parentPath: string[]) => {
    for (const block of blocks) {
      if (index.has(block.id)) continue
      const path = [...parentPath, block.id]
      index.set(block.id, { block, parentId, path, depth: parentPath.length })
      if (block.children?.length) walk(block.children, block.id, path)
    }
  }
  walk(doc.blocks, null, [])
  return index
}
