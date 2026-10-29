import { describe, expect, it } from 'vitest'
import { migrateLegacy, parseDocument, serializeDocument, type LegacyEntity } from '../src/index.js'
import { sampleDoc } from './fixtures.js'

// Shape of the original takesix app's sample data.
const legacy: LegacyEntity[] = [
  {
    id: '1', icon: '⬡', title: 'Frontend', description: 'All client-side concerns', layout: 'list',
    connections: ['2'],
    children: [
      { id: '1-1', title: 'React', description: 'UI component library', connections: ['1-2'] },
      { id: '1-2', title: 'Styling', description: '' },
    ],
  },
  { id: '2', title: 'Backend', description: 'Server side' },
]

describe('migrateLegacy', () => {
  it('converts entities to blocks and connections to links', () => {
    expect(migrateLegacy(legacy, 'Demo')).toEqual({
      takesix: '1.0',
      title: 'Demo',
      blocks: [
        {
          id: '1', title: 'Frontend', description: 'All client-side concerns', icon: '⬡', layout: 'list',
          children: [
            { id: '1-1', title: 'React', description: 'UI component library' },
            { id: '1-2', title: 'Styling' },
          ],
        },
        { id: '2', title: 'Backend', description: 'Server side' },
      ],
      links: [
        { id: '1->2', from: '1', to: '2' },
        { id: '1-1->1-2', from: '1-1', to: '1-2' },
      ],
    })
  })
})

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

  it('migrates legacy arrays', () => {
    const result = parseDocument(JSON.stringify(legacy))
    expect(result.ok && result.migratedFrom).toBe('legacy')
  })

  it('returns errors for invalid documents', () => {
    const result = parseDocument({ takesix: '1.0', title: 'T', blocks: [{ id: 'a' }] })
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
