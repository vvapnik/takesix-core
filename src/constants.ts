import type { BlockShape, LinkDirection, LinkStyle } from './types.js'

/** The core rule: never more than six blocks on one screen. */
export const MAX_BLOCKS_PER_LEVEL = 6

/** Version written into new documents. */
export const FORMAT_VERSION = '1.0'

/** Major version this library can read. */
export const SUPPORTED_MAJOR = 1

/** Columns and rows of the grid every level is laid out on. */
export const GRID_SIZE = 6

export const LINK_DIRECTIONS: readonly LinkDirection[] = ['forward', 'both', 'none']

export const LINK_STYLES: readonly LinkStyle[] = ['solid', 'dashed', 'dotted']

export const BLOCK_SHAPES: readonly BlockShape[] = [
  'process', 'terminator', 'decision', 'io', 'subprocess', 'loop-start', 'loop-end',
]

export const SCHEMA_URL = 'https://raw.githubusercontent.com/vvapnik/takesix-core/main/schema/takesix-1.0.schema.json'
