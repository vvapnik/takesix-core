import { describe, expect, it } from 'vitest'
import { parseDocument, serializeDocument } from '../src/index.js'
import { sampleDoc } from './fixtures.js'

describe('parseDocument', () => {
  it('parses JSON text', () => {
    const result = parseDocument(serializeDocument(sampleDoc()))
    expect(result).toEqual({ ok: true, document: sampleDoc(), issues: [] })
  })

  it('accepts an already parsed value', () => {
    expect(parseDocument(sampleDoc()).ok).toBe(true)
  })

  it('reports invalid JSON instead of throwing', () => {
    const result = parseDocument('{ nope')
    expect(result.ok).toBe(false)
    expect(result.issues[0]!.message).toMatch(/^Invalid JSON/)
  })

  it('rejects the old bare-array format', () => {
    expect(parseDocument([{ id: '1', title: 'Frontend' }])).toMatchObject({ ok: false, issues: [{ code: 'invalid-type' }] })
  })

  it('returns errors for invalid documents', () => {
    const result = parseDocument({ takesix: '1.0', title: 'T', blocks: [{ id: 'a', at: 'A1' }] })
    expect(result).toMatchObject({ ok: false, issues: [{ code: 'missing-field' }] })
  })

  it('passes warnings through on success', () => {
    const result = parseDocument({ ...sampleDoc(), extra: true })
    expect(result).toMatchObject({ ok: true, issues: [{ code: 'unknown-field' }] })
  })
})

describe('serializeDocument', () => {
  it('pretty-prints by default and can be compact', () => {
    expect(serializeDocument(sampleDoc())).toContain('\n  "title": "Shop"')
    expect(serializeDocument(sampleDoc(), { pretty: false })).not.toContain('\n')
  })
})
