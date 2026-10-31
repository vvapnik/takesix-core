import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { DEFAULT_SIZE, LINK_DIRECTIONS, MAX_BLOCKS_PER_LEVEL, SCHEMA_URL, SIZES } from '../src/index.js'

const schema = JSON.parse(readFileSync(new URL('../schema/takesix-1.0.schema.json', import.meta.url), 'utf8'))

// The JSON Schema is hand-written for editors and agents; keep it in sync
// with the constants the validator uses.
describe('JSON Schema', () => {
  it('matches the library constants', () => {
    expect(schema.$id).toBe(SCHEMA_URL)
    expect(schema.$defs.blocks.maxItems).toBe(MAX_BLOCKS_PER_LEVEL)
    expect(schema.$defs.size.enum).toEqual(SIZES)
    expect(schema.$defs.size.default).toBe(DEFAULT_SIZE)
    expect(schema.$defs.link.properties.direction.enum).toEqual(LINK_DIRECTIONS)
  })
})
