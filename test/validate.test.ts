import { describe, expect, it } from 'vitest'
import { validateDocument, type IssueCode } from '../src/index.js'
import { blocks, sampleDoc } from './fixtures.js'

const codes = (input: unknown): IssueCode[] => validateDocument(input).issues.map(i => i.code)

describe('validateDocument', () => {
  it('accepts a valid document', () => {
    expect(validateDocument(sampleDoc())).toEqual({ valid: true, issues: [] })
  })

  it('rejects a block with both children and details, and says what to do instead', () => {
    const doc = {
      takesix: '1.0', title: 'T',
      blocks: [{ id: 'p', title: 'P', at: 'A1', details: 'Intro', children: [{ id: 'c', title: 'C', at: 'A1' }] }],
    }
    const result = validateDocument(doc)
    expect(result.valid).toBe(false)
    expect(result.issues).toMatchObject([{ code: 'details-with-children', path: '/blocks/0/details' }])
    const message = result.issues[0]!.message
    for (const way of ['Drop', '"description"', 'child block of its own', 'fold']) expect(message).toContain(way)
    // Either one alone is fine
    expect(validateDocument({ ...doc, blocks: [{ id: 'p', title: 'P', at: 'A1', details: 'Text' }] }).valid).toBe(true)
  })

  it('rejects non-objects', () => {
    expect(validateDocument(null).valid).toBe(false)
    expect(validateDocument('x').valid).toBe(false)
  })

  it('requires version, title and blocks', () => {
    expect(codes({})).toEqual(['missing-field', 'missing-field', 'missing-field'])
  })

  it('rejects unsupported major versions but accepts newer minors', () => {
    expect(codes({ ...sampleDoc(), takesix: '2.0' })).toEqual(['unsupported-version'])
    expect(codes({ ...sampleDoc(), takesix: 'one' })).toEqual(['invalid-value'])
    expect(validateDocument({ ...sampleDoc(), takesix: '1.3' }).valid).toBe(true)
  })

  it('enforces at most six blocks per level, at any depth', () => {
    expect(validateDocument({ takesix: '1.0', title: 'T', blocks: blocks(6) }).valid).toBe(true)

    const seven = [...blocks(6), { id: 'b6', title: 'Block 6', at: 'A1' }]
    const top = validateDocument({ takesix: '1.0', title: 'T', blocks: seven })
    expect(top.issues.filter(i => i.code !== 'overlap')).toMatchObject([{ code: 'too-many-blocks', path: '/blocks' }])

    const nested = validateDocument({
      takesix: '1.0', title: 'T',
      blocks: [{ id: 'p', title: 'P', at: 'A1', children: blocks(6, 'c').concat({ id: 'c6', title: 'C', at: 'A6' }) }],
    })
    expect(nested.issues.filter(i => i.code !== 'overlap')).toMatchObject([{ code: 'too-many-blocks', path: '/blocks/0/children' }])
  })

  it('reports duplicate block ids across levels', () => {
    const doc = sampleDoc()
    doc.blocks[2]!.id = 'auth'
    const result = validateDocument(doc)
    expect(result.issues).toMatchObject([
      { code: 'duplicate-id', path: '/blocks/2/id' },
      // the link to "db" now has no target
      { code: 'unknown-link-endpoint' },
      { code: 'unknown-link-endpoint' },
    ])
  })

  it('checks block fields', () => {
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', at: 'A1' }] })).toEqual(['missing-field'])
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: '  ', at: 'A1' }] })).toEqual(['invalid-value'])
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 1, title: 'A', at: 'A1' }] })).toEqual(['invalid-type'])
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: 'A', at: 'A1', children: {} }] })).toEqual(['invalid-type'])
  })

  it('requires a place on the grid', () => {
    const one = (block: object) => validateDocument({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: 'A', ...block }] })
    expect(one({ at: 'B3' }).valid).toBe(true)
    expect(one({ at: 'A1:F6' }).valid).toBe(true)
    expect(one({}).issues).toMatchObject([{ code: 'missing-field', path: '/blocks/0' }])
    expect(one({ at: 3 }).issues).toMatchObject([{ code: 'invalid-type', path: '/blocks/0/at' }])
    for (const at of ['G1', 'A7', 'A0', 'a1', 'A1:', 'A1:B2:C3', 'A1-B2', '']) {
      expect(one({ at }).issues, at).toMatchObject([{ code: 'invalid-value', path: '/blocks/0/at' }])
    }
    expect(one({ at: 'C2:A1' }).issues[0]!.message).toMatch(/ends before it starts/)
  })

  it('reports blocks that overlap on one level', () => {
    const result = validateDocument({
      takesix: '1.0', title: 'T',
      blocks: [
        { id: 'a', title: 'A', at: 'A1:C2' },
        { id: 'b', title: 'B', at: 'D1:F1' },
        { id: 'c', title: 'C', at: 'B2:E3' },
      ],
    })
    expect(result.issues).toEqual([{
      severity: 'error', code: 'overlap', path: '/blocks/2/at', message: 'Blocks "a" and "c" overlap at B2',
    }])
    // Blocks of different levels never overlap
    expect(validateDocument(sampleDoc()).valid).toBe(true)
  })

  it('warns about unknown fields, the old "size" too, without failing', () => {
    const result = validateDocument({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: 'A', at: 'A1', colour: 'red', size: 'F' }] })
    expect(result.valid).toBe(true)
    expect(result.issues).toMatchObject([
      { severity: 'warning', code: 'unknown-field', path: '/blocks/0/colour' },
      { severity: 'warning', code: 'unknown-field', path: '/blocks/0/size' },
    ])
  })

  it('checks link endpoints', () => {
    const doc = sampleDoc()
    doc.links = [
      { from: 'web', to: 'nope' },
      { from: 'web', to: 'web' },
      { from: 'web', to: 'db', direction: 'sideways' as never },
    ]
    expect(codes(doc)).toEqual(['unknown-link-endpoint', 'self-link', 'invalid-value'])
  })

  it('reports duplicate link ids', () => {
    const doc = sampleDoc()
    doc.links![1]!.id = 'l1'
    expect(codes(doc)).toEqual(['duplicate-link-id'])
  })

  it('warns about links between blocks of different levels', () => {
    const doc = sampleDoc()
    for (const link of [{ from: 'orders-svc', to: 'api' }, { from: 'auth', to: 'db' }]) {
      doc.links = [link]
      const result = validateDocument(doc)
      expect(result.valid).toBe(true)
      expect(result.issues).toMatchObject([{ severity: 'warning', code: 'link-never-visible' }])
    }
  })

  it('checks shape and style values', () => {
    const doc = sampleDoc()
    doc.blocks[0]!.shape = 'decision'
    doc.blocks[2]!.shape = 'circle' as never
    doc.links = [{ from: 'web', to: 'api', label: 'yes' }, { from: 'web', to: 'db', label: 'no', style: 'wavy' as never }]
    expect(validateDocument(doc).issues.map(i => [i.code, i.path])).toEqual([
      ['invalid-value', '/blocks/2/shape'],
      ['invalid-value', '/links/1/style'],
    ])
  })
})

describe('flowchart warnings', () => {
  const flow = (blocks: Record<string, unknown>[], links: Record<string, unknown>[]) =>
    validateDocument({ takesix: '1.0', title: 'T', blocks, links }).issues.map(i => [i.severity, i.code, i.path])

  it('wants 2–3 labelled exits from a decision', () => {
    const blocks = [
      { id: 'q', title: 'Q?', at: 'A1', shape: 'decision' },
      { id: 'a', title: 'A', at: 'B1' }, { id: 'b', title: 'B', at: 'A2' },
    ]
    expect(flow(blocks, [{ from: 'q', to: 'a', label: 'yes' }])).toEqual([['warning', 'decision-exits', '/blocks/0']])
    expect(flow(blocks, [{ from: 'q', to: 'a', label: 'yes' }, { from: 'q', to: 'b', label: ' ' }]))
      .toEqual([['warning', 'decision-exit-label', '/blocks/0']])
    expect(flow(blocks, [{ from: 'q', to: 'a', label: 'yes' }, { from: 'q', to: 'b', label: 'no' }])).toEqual([])
  })

  it('wants one start per level', () => {
    const blocks = [
      { id: 's', title: 'Start', at: 'A1', shape: 'terminator' },
      { id: 'p', title: 'P', at: 'A2', children: [
        { id: 's1', title: 'Start', at: 'A1', shape: 'terminator' },
        { id: 's2', title: 'Start', at: 'A2', shape: 'terminator' },
      ] },
      { id: 'e', title: 'End', at: 'A3', shape: 'terminator' },
    ]
    // "e" ends the top level: a link leads into it
    expect(flow(blocks, [{ from: 's', to: 'p' }, { from: 'p', to: 'e' }]))
      .toEqual([['warning', 'several-starts', '/blocks/1/children']])
  })
})
