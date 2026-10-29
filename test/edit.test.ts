import { describe, expect, it } from 'vitest'
import {
  addBlock,
  addLink,
  canAddBlock,
  createDocument,
  findBlock,
  getLevel,
  getPath,
  groupBlocks,
  moveBlock,
  removeBlock,
  removeLink,
  TakeSixError,
  ungroupBlock,
  updateBlock,
  updateLink,
  validateDocument,
} from '../src/index.js'
import { blocks, sampleDoc } from './fixtures.js'

const ids = (list: { id: string }[]) => list.map(b => b.id)

function expectError(fn: () => unknown, code: TakeSixError['code']) {
  try {
    fn()
  } catch (e) {
    expect(e).toBeInstanceOf(TakeSixError)
    expect((e as TakeSixError).code).toBe(code)
    return
  }
  throw new Error(`Expected TakeSixError "${code}"`)
}

describe('queries', () => {
  it('finds blocks, paths and levels', () => {
    const doc = sampleDoc()
    expect(findBlock(doc, 'orders-queue')?.title).toBe('Queue')
    expect(findBlock(doc, 'nope')).toBeUndefined()
    expect(ids(getPath(doc, 'orders-queue'))).toEqual(['api', 'orders', 'orders-queue'])
    expect(ids(getLevel(doc, null))).toEqual(['web', 'api', 'db'])
    expect(ids(getLevel(doc, 'api'))).toEqual(['auth', 'orders'])
    expect(getLevel(doc, 'web')).toEqual([])
  })

  it('knows when a level is full', () => {
    const doc = createDocument({ blocks: blocks(6) })
    expect(canAddBlock(doc, null)).toBe(false)
    expect(canAddBlock(doc, 'b0')).toBe(true)
    expect(canAddBlock(doc, 'nope')).toBe(false)
  })
})

describe('createDocument', () => {
  it('creates an empty valid document', () => {
    const doc = createDocument({ title: 'New' })
    expect(doc).toEqual({ takesix: '1.0', title: 'New', blocks: [] })
    expect(validateDocument(doc).valid).toBe(true)
  })
})

describe('addBlock', () => {
  it('adds at the top level and inside blocks, without mutating the input', () => {
    const doc = sampleDoc()
    const snapshot = JSON.stringify(doc)

    const top = addBlock(doc, null, { id: 'cdn', title: 'CDN' }, { index: 0 })
    expect(ids(top.document.blocks)).toEqual(['cdn', 'web', 'api', 'db'])

    const nested = addBlock(doc, 'web', { title: 'SPA' })
    expect(nested.block.id).toMatch(/\w+/)
    expect(getLevel(nested.document, 'web')).toEqual([nested.block])

    expect(JSON.stringify(doc)).toBe(snapshot)
  })

  it('shares untouched subtrees', () => {
    const doc = sampleDoc()
    const { document } = addBlock(doc, 'orders', { id: 'x', title: 'X' })
    expect(document.blocks[0]).toBe(doc.blocks[0])
    expect(document.blocks[2]).toBe(doc.blocks[2])
    expect(document.blocks[1]).not.toBe(doc.blocks[1])
  })

  it('refuses a seventh block', () => {
    const doc = createDocument({ blocks: blocks(6) })
    expectError(() => addBlock(doc, null, { title: 'One too many' }), 'too-many-blocks')
  })

  it('refuses duplicate ids, including inside the new subtree', () => {
    const doc = sampleDoc()
    expectError(() => addBlock(doc, null, { id: 'auth', title: 'Dup' }), 'duplicate-id')
    expectError(() => addBlock(doc, null, { id: 'new', title: 'N', children: [{ id: 'db', title: 'Dup' }] }), 'duplicate-id')
  })

  it('fails on an unknown parent', () => {
    expectError(() => addBlock(sampleDoc(), 'nope', { title: 'X' }), 'not-found')
  })
})

describe('updateBlock', () => {
  it('changes fields and removes those set to undefined', () => {
    let doc = updateBlock(sampleDoc(), 'auth', { description: 'OAuth', icon: '🔑' })
    expect(findBlock(doc, 'auth')).toEqual({ id: 'auth', title: 'Auth', description: 'OAuth', icon: '🔑' })
    doc = updateBlock(doc, 'auth', { icon: undefined })
    expect(findBlock(doc, 'auth')).toEqual({ id: 'auth', title: 'Auth', description: 'OAuth' })
  })

  it('fails on an unknown block', () => {
    expectError(() => updateBlock(sampleDoc(), 'nope', { title: 'X' }), 'not-found')
  })
})

describe('removeBlock', () => {
  it('removes the subtree and every link touching it', () => {
    const doc = removeBlock(sampleDoc(), 'orders')
    expect(ids(getLevel(doc, 'api'))).toEqual(['auth'])
    expect(findBlock(doc, 'orders-svc')).toBeUndefined()
    expect(doc.links!.map(l => l.id)).toEqual(['l1', 'l3'])
    expect(validateDocument(doc).valid).toBe(true)
  })

  it('drops the empty children array and links array', () => {
    let doc = removeBlock(sampleDoc(), 'orders-svc')
    doc = removeBlock(doc, 'orders-queue')
    expect(findBlock(doc, 'orders')).toEqual({ id: 'orders', title: 'Orders' })

    const bare = removeBlock(createDocument({ blocks: [{ id: 'a', title: 'A' }, { id: 'b', title: 'B' }], links: [{ id: 'x', from: 'a', to: 'b' }] }), 'a')
    expect(bare).not.toHaveProperty('links')
  })
})

describe('moveBlock', () => {
  it('moves a block with its subtree and keeps links', () => {
    const doc = moveBlock(sampleDoc(), 'orders', null, { index: 1 })
    expect(ids(doc.blocks)).toEqual(['web', 'orders', 'api', 'db'])
    expect(ids(getLevel(doc, 'api'))).toEqual(['auth'])
    expect(ids(getLevel(doc, 'orders'))).toEqual(['orders-svc', 'orders-queue'])
    expect(doc.links).toHaveLength(5)
  })

  it('reorders within the same level', () => {
    const doc = moveBlock(sampleDoc(), 'db', null, { index: 0 })
    expect(ids(doc.blocks)).toEqual(['db', 'web', 'api'])
  })

  it('refuses to move a block into itself or its descendant', () => {
    expectError(() => moveBlock(sampleDoc(), 'api', 'api'), 'invalid-move')
    expectError(() => moveBlock(sampleDoc(), 'api', 'orders'), 'invalid-move')
  })

  it('refuses to overfill the target level', () => {
    const doc = createDocument({ blocks: [...blocks(5), { id: 'p', title: 'P', children: blocks(6, 'c') }] })
    expectError(() => moveBlock(doc, 'b0', 'p'), 'too-many-blocks')
  })
})

describe('groupBlocks / ungroupBlock', () => {
  it('wraps siblings into a new parent where the first one was', () => {
    const doc = createDocument({ blocks: blocks(6) })
    const { document, block } = groupBlocks(doc, ['b4', 'b2'], { id: 'g', title: 'Group' })
    expect(ids(document.blocks)).toEqual(['b0', 'b1', 'g', 'b3', 'b5'])
    expect(ids(block.children!)).toEqual(['b2', 'b4'])
    expect(canAddBlock(document, null)).toBe(true)
  })

  it('only groups siblings', () => {
    expectError(() => groupBlocks(sampleDoc(), ['web', 'auth'], { title: 'G' }), 'invalid-move')
    expectError(() => groupBlocks(sampleDoc(), [], { title: 'G' }), 'invalid-move')
  })

  it('ungroup restores the children in place and drops links of the group', () => {
    let doc = sampleDoc()
    doc = addLink(doc, { id: 'to-api', from: 'db', to: 'api' }).document
    doc = ungroupBlock(doc, 'api')
    expect(ids(doc.blocks)).toEqual(['web', 'auth', 'orders', 'db'])
    expect(doc.links!.map(l => l.id)).toEqual(['l2', 'l3', 'l4', 'l5'])
  })

  it('ungroup refuses to overfill the level', () => {
    const doc = createDocument({ blocks: [...blocks(5), { id: 'p', title: 'P', children: blocks(2, 'c') }] })
    expectError(() => ungroupBlock(doc, 'p'), 'too-many-blocks')
  })
})

describe('links', () => {
  it('adds links with generated ids', () => {
    const { document, link } = addLink(sampleDoc(), { from: 'web', to: 'db', label: 'cache' })
    expect(link.id).toMatch(/^l/)
    expect(document.links).toHaveLength(6)
    expect(addLink(createDocument({ blocks: blocks(2) }), { from: 'b0', to: 'b1' }).document.links).toHaveLength(1)
  })

  it('rejects bad endpoints', () => {
    expectError(() => addLink(sampleDoc(), { from: 'web', to: 'nope' }), 'not-found')
    expectError(() => addLink(sampleDoc(), { from: 'web', to: 'web' }), 'invalid-link')
    expectError(() => addLink(sampleDoc(), { from: 'orders-svc', to: 'api' }), 'invalid-link')
    expectError(() => addLink(sampleDoc(), { id: 'l1', from: 'web', to: 'db' }), 'duplicate-id')
  })

  it('updates and removes links', () => {
    let doc = updateLink(sampleDoc(), 'l1', { label: 'GraphQL', direction: 'both' })
    expect(doc.links![0]).toEqual({ id: 'l1', from: 'web', to: 'api', label: 'GraphQL', direction: 'both' })
    doc = updateLink(doc, 'l1', { to: 'db' })
    expect(doc.links![0]!.to).toBe('db')
    expectError(() => updateLink(doc, 'l1', { to: 'web' }), 'invalid-link')
    expectError(() => updateLink(doc, 'nope', {}), 'not-found')

    doc = removeLink(doc, 'l1')
    expect(doc.links!.map(l => l.id)).toEqual(['l2', 'l3', 'l4', 'l5'])
    expectError(() => removeLink(doc, 'l1'), 'not-found')
  })
})
