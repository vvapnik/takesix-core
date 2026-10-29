import { describe, expect, it } from 'vitest'
import { validateDocument, type IssueCode } from '../src/index.js'
import { blocks, sampleDoc } from './fixtures.js'

const codes = (input: unknown): IssueCode[] => validateDocument(input).issues.map(i => i.code)

describe('validateDocument', () => {
  it('accepts a valid document', () => {
    expect(validateDocument(sampleDoc())).toEqual({ valid: true, issues: [] })
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

    const top = validateDocument({ takesix: '1.0', title: 'T', blocks: blocks(7) })
    expect(top.issues).toMatchObject([{ code: 'too-many-blocks', path: '/blocks' }])

    const nested = validateDocument({
      takesix: '1.0', title: 'T',
      blocks: [{ id: 'p', title: 'P', children: blocks(7, 'c') }],
    })
    expect(nested.issues).toMatchObject([{ code: 'too-many-blocks', path: '/blocks/0/children' }])
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
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 'a' }] })).toEqual(['missing-field'])
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: '  ' }] })).toEqual(['invalid-value'])
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 1, title: 'A' }] })).toEqual(['invalid-type'])
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: 'A', layout: 'grid' }] })).toEqual(['invalid-value'])
    expect(codes({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: 'A', children: {} }] })).toEqual(['invalid-type'])
  })

  it('warns about unknown fields without failing', () => {
    const result = validateDocument({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', title: 'A', colour: 'red' }] })
    expect(result.valid).toBe(true)
    expect(result.issues).toMatchObject([{ severity: 'warning', code: 'unknown-field', path: '/blocks/0/colour' }])
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

  it('warns about links between a block and its ancestor', () => {
    const doc = sampleDoc()
    doc.links = [{ from: 'orders-svc', to: 'api' }]
    const result = validateDocument(doc)
    expect(result.valid).toBe(true)
    expect(result.issues).toMatchObject([{ severity: 'warning', code: 'link-never-visible' }])
  })
})
