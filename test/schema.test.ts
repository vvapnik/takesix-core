import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { BLOCK_SHAPES, LINK_DIRECTIONS, LINK_STYLES, MAX_BLOCKS_PER_LEVEL, readArea, SCHEMA_URL } from '../src/index.js'

const schema = JSON.parse(readFileSync(new URL('../schema/takesix-1.0.schema.json', import.meta.url), 'utf8'))

// The JSON Schema is hand-written for editors and agents; keep it in sync
// with the constants the validator uses.
describe('JSON Schema', () => {
  it('matches the library constants', () => {
    expect(schema.$id).toBe(SCHEMA_URL)
    expect(schema.$defs.blocks.maxItems).toBe(MAX_BLOCKS_PER_LEVEL)
    expect(schema.$defs.block.required).toContain('at')
    expect(schema.$defs.link.properties.direction.enum).toEqual(LINK_DIRECTIONS)
    expect(schema.$defs.link.properties.style.enum).toEqual(LINK_STYLES)
    expect(schema.$defs.block.properties.shape.enum).toEqual(BLOCK_SHAPES)
    // A block opens into blocks or into text
    expect(schema.$defs.block.not.required).toEqual(['children', 'details'])
  })

  it('accepts the same "at" syntax as the validator, apart from corner order', () => {
    const pattern = new RegExp(schema.$defs.area.pattern)
    for (const at of ['A1', 'F6', 'A1:C2', 'B2:B2', 'G1', 'A7', 'a1', 'A1:B2:C3', 'A10']) {
      expect(pattern.test(at), at).toBe(typeof readArea(at) !== 'string')
    }
    // A pattern cannot compare corners: the validator rejects this one
    expect(pattern.test('C2:A1')).toBe(true)
  })
})
