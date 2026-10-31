export type { Block, Link, LinkDirection, Meta, Size, TakeSixDocument } from './types.js'
export { DEFAULT_SIZE, FORMAT_VERSION, LINK_DIRECTIONS, MAX_BLOCKS_PER_LEVEL, SCHEMA_URL, SIZES } from './constants.js'
export { TakeSixError, type TakeSixErrorCode } from './errors.js'
export { createId } from './id.js'
export { buildIndex, type IndexEntry, type TreeIndex } from './tree-index.js'
export {
  formatIssues,
  validateDocument,
  type IssueCode,
  type IssueSeverity,
  type ValidationIssue,
  type ValidationResult,
} from './validate.js'
export { isLegacyDocument, migrateLegacy, type LegacyEntity } from './migrate.js'
export { parseDocument, serializeDocument, type ParseResult } from './parse.js'
export { canAddBlock, findBlock, getLevel, getPath } from './query.js'
export {
  addBlock,
  addLink,
  createDocument,
  groupBlocks,
  moveBlock,
  removeBlock,
  removeLink,
  ungroupBlock,
  updateBlock,
  updateLink,
  type BlockChanges,
  type LinkChanges,
  type NewBlock,
  type NewLink,
} from './edit.js'
export { visibleLinks, type VisibleLink } from './links.js'
