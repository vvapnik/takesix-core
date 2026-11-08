import { describe, expect, it } from 'vitest'
import { visibleLinks, type TakeSixDocument } from '../src/index.js'
import { sampleDoc } from './fixtures.js'

const summary = (doc: TakeSixDocument, parentId: string | null) =>
  visibleLinks(doc, parentId).map(v => ({ key: v.key, direction: v.direction, style: v.style, links: v.links.map(l => l.id) }))

describe('visibleLinks', () => {
  it('draws links between blocks of one level only, not across levels', () => {
    const doc = sampleDoc()
    doc.links!.push({ id: 'x', from: 'orders-svc', to: 'db' }, { id: 'y', from: 'auth', to: 'web' })
    expect(summary(doc, null)).toEqual([
      { key: 'web|api', direction: 'forward', style: 'solid', links: ['l1'] },
      { key: 'api|db', direction: 'forward', style: 'solid', links: ['l2'] },
      { key: 'web|db', direction: 'forward', style: 'solid', links: ['l3'] },
    ])
  })

  it('shows only links that stay inside the opened block', () => {
    expect(summary(sampleDoc(), 'api')).toEqual([
      { key: 'auth|orders', direction: 'forward', style: 'solid', links: ['l5'] },
    ])
    expect(summary(sampleDoc(), 'orders')).toEqual([
      { key: 'orders-svc|orders-queue', direction: 'forward', style: 'solid', links: ['l4'] },
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
    expect(summary(doc, null)).toEqual([{ key: 'web|db', direction: 'both', style: 'solid', links: ['a', 'b'] }])
  })

  it('keeps the orientation of one-way links regardless of id order', () => {
    const doc = sampleDoc()
    doc.links = [{ id: 'a', from: 'web', to: 'api' }, { id: 'b', from: 'api', to: 'web', direction: 'none' }]
    expect(summary(doc, null)).toEqual([{ key: 'web|api', direction: 'forward', style: 'solid', links: ['a', 'b'] }])

    doc.links = [{ id: 'b', from: 'db', to: 'api' }]
    expect(summary(doc, null)).toEqual([{ key: 'db|api', direction: 'forward', style: 'solid', links: ['b'] }])
  })

  it('keeps the file orientation of undirected links', () => {
    const doc = sampleDoc()
    doc.links = [{ id: 'a', from: 'web', to: 'db', direction: 'none' }]
    expect(summary(doc, null)).toEqual([{ key: 'web|db', direction: 'none', style: 'solid', links: ['a'] }])
  })

  it('keeps a style the merged links share, else solid', () => {
    const doc = sampleDoc()
    doc.links = [{ id: 'a', from: 'web', to: 'db', style: 'dashed' }, { id: 'b', from: 'db', to: 'web', style: 'dashed' }]
    expect(summary(doc, null)).toMatchObject([{ style: 'dashed' }])
    doc.links[1]!.style = 'dotted'
    expect(summary(doc, null)).toMatchObject([{ style: 'solid' }])
  })
})
