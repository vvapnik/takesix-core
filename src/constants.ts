import type { Layout, LinkDirection } from './types.js'

/** The core rule: never more than six blocks on one screen. */
export const MAX_BLOCKS_PER_LEVEL = 6

/** Version written into new documents. */
export const FORMAT_VERSION = '1.0'

/** Major version this library can read. */
export const SUPPORTED_MAJOR = 1

export const LAYOUTS: readonly Layout[] = ['tiles', 'list', 'circle']

export const LINK_DIRECTIONS: readonly LinkDirection[] = ['forward', 'both', 'none']

export const SCHEMA_URL = 'https://raw.githubusercontent.com/vvapnik/takesix-core/main/schema/takesix-1.0.schema.json'
