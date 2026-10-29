import { describe, expect, it } from 'vitest'
import { visibleLinks, type TakeSixDocument } from '../src/index.js'
import { sampleDoc } from './fixtures.js'

const summary = (doc: TakeSixDocument, parentId: string | null) =>
  visibleLinks(doc, parentId).map(v => ({ key: v.key, direction: v.direction, direct: v.direct, links: v.links.map(l => l.id) }))

describe('visibleLinks', () => {
  it('lifts nested endpoints to their ancestors on the top level', () => {
    expect(summary(sampleDoc(), null)).toEqual([
      { key: 'web|api', direction: 'forward', direct: true, links: ['l1'] },
      // orders-svc → db and auth → db both come out of "api"
      { key: 'api|db', direction: 'forward', direct: false, links: ['l2', 'l3'] },
    ])
  })

  it('shows only links that stay inside the opened block', () => {
    expect(summary(sampleDoc(), 'api')).toEqual([
      { key: 'auth|orders', direction: 'forward', direct: true, links: ['l5'] },
    ])
    expect(summary(sampleDoc(), 'orders')).toEqual([
      { key: 'orders-svc|orders-queue', direction: 'forward', direct: true, links: ['l4'] },
    ])
  })

  it('returns nothing for leaves and unknown blocks', () => {
    expect(visibleLinks(sampleDoc(), 'web')).toEqual([])
    expect(visibleLinks(sampleDoc(), 'nope')).toEqual([])
  })

  it('merges opposite links into one two-way arrow', () => {
    const doc = sampleDoc()
    doc.links = [
      { id: 'a', from: 'web', to: 'db' },
      { id: 'b', from: 'db', to: 'web' },
    ]
    expect(summary(doc, null)).toEqual([{ key: 'web|db', direction: 'both', direct: true, links: ['a', 'b'] }])
  })

  it('keeps the orientation of one-way links regardless of id order', () => {
    const doc = sampleDoc()
    doc.links = [{ id: 'a', from: 'web', to: 'api' }, { id: 'b', from: 'api', to: 'web', direction: 'none' }]
    expect(summary(doc, null)).toEqual([{ key: 'web|api', direction: 'forward', direct: true, links: ['a', 'b'] }])

    doc.links = [{ id: 'b', from: 'db', to: 'api' }]
    expect(summary(doc, null)).toEqual([{ key: 'db|api', direction: 'forward', direct: true, links: ['b'] }])
  })

  it('keeps the file orientation of undirected links', () => {
    const doc = sampleDoc()
    doc.links = [{ id: 'a', from: 'web', to: 'db', direction: 'none' }]
    expect(summary(doc, null)).toEqual([{ key: 'web|db', direction: 'none', direct: true, links: ['a'] }])
  })
})
