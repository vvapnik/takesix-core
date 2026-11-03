/** Free-form extension data. Core never interprets it, but keeps it intact. */
export type Meta = Record<string, unknown>

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
  /** Long-form Markdown shown in the details panel. */
  details?: string
  /** An emoji or a single character. */
  icon?: string
  /**
   * Where the block sits on its level's 6×6 grid: one cell (`"B3"`) or a
   * range with both corners included (`"A1:C2"`). Columns `A`–`F`, rows
   * `1`–`6`. Blocks of one level never overlap.
   */
  at: string
  children?: Block[]
  meta?: Meta
}

/** Which way a link points. Defaults to `'forward'` (from → to). */
export type LinkDirection = 'forward' | 'both' | 'none'

/**
 * A connection between two blocks. Endpoints may sit on different levels;
 * on screen the link is drawn between their visible ancestors
 * (see {@link visibleLinks}).
 */
export interface Link {
  /** Unique among links. Optional in files, always set by the editing helpers. */
  id?: string
  from: string
  to: string
  label?: string
  description?: string
  direction?: LinkDirection
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
