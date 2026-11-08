/** Free-form extension data. Core never interprets it, but keeps it intact. */
export type Meta = Record<string, unknown>

/**
 * Outline of a block, for flowcharts. Symbols follow ISO 5807 (ГОСТ 19.701-90,
 * DIN 66001); `'process'` (a plain card) is the default.
 */
export type BlockShape = 'process' | 'terminator' | 'decision' | 'io' | 'subprocess' | 'loop-start' | 'loop-end'

/**
 * A single block on screen. Each block may contain up to
 * {@link MAX_BLOCKS_PER_LEVEL} child blocks, which are shown when the user
 * drills into it.
 */
export interface Block {
  /** Unique across the whole document. Stable: never reuse or rename. */
  id: string
  title: string
  /** Short plain-text summary shown on the card. */
  description?: string
  /**
   * Long-form Markdown. A block with `details` opens into this text instead
   * of child blocks, so it never has `children` too.
   */
  details?: string
  /** An emoji or a single character. */
  icon?: string
  /** Flowchart symbol. Defaults to `'process'`, a plain card. */
  shape?: BlockShape
  /**
   * Where the block sits on its level's 6×6 grid: one cell (`"B3"`) or a
   * range with both corners included (`"A1:C2"`). Columns `A`–`F`, rows
   * `1`–`6`. Blocks of one level never overlap.
   */
  at: string
  /** At most 6. Never together with `details`: a block opens into blocks or into text. */
  children?: Block[]
  meta?: Meta
}

/** Which way a link points. Defaults to `'forward'` (from → to). */
export type LinkDirection = 'forward' | 'both' | 'none'

/** How the arrow's line is drawn. Defaults to `'solid'`. */
export type LinkStyle = 'solid' | 'dashed' | 'dotted'

/**
 * A connection between two blocks. Only links between blocks of one level
 * (same parent) are drawn (see {@link visibleLinks}); a link across levels is
 * kept in the file but never shown.
 */
export interface Link {
  /** Unique among links. Optional in files, always set by the editing helpers. */
  id?: string
  from: string
  to: string
  label?: string
  description?: string
  direction?: LinkDirection
  style?: LinkStyle
  meta?: Meta
}

export interface TakeSixDocument {
  /** Format version, `"1.0"`. */
  takesix: string
  /** Optional JSON Schema reference for editors. */
  $schema?: string
  title: string
  description?: string
  /** Top-level blocks. */
  blocks: Block[]
  links?: Link[]
  meta?: Meta
}
