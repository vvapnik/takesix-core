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

    const top = addBlock(doc, null, { id: 'cdn', title: 'CDN', at: 'A3:F3' })
    expect(ids(top.document.blocks)).toEqual(['web', 'api', 'db', 'cdn'])
    expect(top.block.at).toBe('A3:F3')

    const nested = addBlock(doc, 'web', { title: 'SPA' })
    expect(nested.block.id).toMatch(/\w+/)
    expect(getLevel(nested.document, 'web')).toEqual([nested.block])

    expect(JSON.stringify(doc)).toBe(snapshot)
  })

  it('puts a block without "at" in the first free place, half the grid wide', () => {
    const { block } = addBlock(sampleDoc(), null, { id: 'cdn', title: 'CDN' })
    expect(block.at).toBe('A3:C3')
    // Only one column left: the new block gets one cell
    const narrow = createDocument({ blocks: [{ id: 'big', title: 'Big', at: 'A1:E6' }] })
    expect(addBlock(narrow, null, { title: 'X' }).block.at).toBe('F1')
  })

  it('keeps the level in reading order', () => {
    const { document } = addBlock(sampleDoc(), null, { id: 'top', title: 'Top', at: 'A3' })
    const moved = updateBlock(document, 'web', { at: 'A4:F4' })
    expect(ids(moved.blocks)).toEqual(['api', 'db', 'top', 'web'])
  })

  it('refuses a bad or taken place, and a full grid', () => {
    expectError(() => addBlock(sampleDoc(), null, { title: 'X', at: 'B1' }), 'overlap')
    expectError(() => addBlock(sampleDoc(), null, { title: 'X', at: 'G1' }), 'invalid-area')
    expectError(() => addBlock(sampleDoc(), null, { title: 'X', at: 'C3:A3' }), 'invalid-area')
    const full = createDocument({ blocks: [{ id: 'big', title: 'Big', at: 'A1:F6' }] })
    expectError(() => addBlock(full, null, { title: 'X' }), 'no-room')
  })

  it('shares untouched subtrees', () => {
    const doc = sampleDoc()
    const { document } = addBlock(doc, 'orders', { id: 'x', title: 'X' })
    expect(document.blocks[0]).toBe(doc.blocks[0])
    expect(document.blocks[2]).toBe(doc.blocks[2])
    expect(document.blocks[1]).not.toBe(doc.blocks[1])
  })

  it('refuses a seventh block', () => {
    const doc = createDocument({ blocks: blocks(5).concat({ id: 'b5', title: 'Last', at: 'A6' }) })
    expectError(() => addBlock(doc, null, { title: 'One too many' }), 'too-many-blocks')
  })

  it('refuses duplicate ids, including inside the new subtree', () => {
    const doc = sampleDoc()
    expectError(() => addBlock(doc, null, { id: 'auth', title: 'Dup' }), 'duplicate-id')
    expectError(() => addBlock(doc, null, { id: 'new', title: 'N', children: [{ id: 'db', title: 'Dup', at: 'A1' }] }), 'duplicate-id')
  })

  it('fails on an unknown parent', () => {
    expectError(() => addBlock(sampleDoc(), 'nope', { title: 'X' }), 'not-found')
  })
})

describe('updateBlock', () => {
  it('changes fields and removes those set to undefined', () => {
    let doc = updateBlock(sampleDoc(), 'auth', { description: 'OAuth', icon: '🔑' })
    expect(findBlock(doc, 'auth')).toEqual({ id: 'auth', title: 'Auth', at: 'A1:B1', description: 'OAuth', icon: '🔑' })
    doc = updateBlock(doc, 'auth', { icon: undefined })
    expect(findBlock(doc, 'auth')).toEqual({ id: 'auth', title: 'Auth', at: 'A1:B1', description: 'OAuth' })
  })

  it('moves a block on its grid only to a free place', () => {
    const doc = updateBlock(sampleDoc(), 'db', { at: 'A3:F4' })
    expect(findBlock(doc, 'db')?.at).toBe('A3:F4')
    // Its own old cells do not count as taken
    expect(findBlock(updateBlock(sampleDoc(), 'web', { at: 'A1:B1' }), 'web')?.at).toBe('A1:B1')
    expectError(() => updateBlock(sampleDoc(), 'db', { at: 'C1' }), 'overlap')
    expectError(() => updateBlock(sampleDoc(), 'db', { at: 'nowhere' }), 'invalid-area')
    expectError(() => updateBlock(sampleDoc(), 'db', { at: undefined }), 'invalid-area')
  })

  it('fails on an unknown block', () => {
    expectError(() => updateBlock(sampleDoc(), 'nope', { title: 'X' }), 'not-found')
  })
})

describe('text blocks', () => {
  it('a block opens into blocks or into text, never both', () => {
    const text = updateBlock(sampleDoc(), 'web', { details: 'Some **text**' })
    expectError(() => addBlock(text, 'web', { title: 'X' }), 'text-block')
    expectError(() => moveBlock(text, 'db', 'web'), 'text-block')
    expectError(() => updateBlock(sampleDoc(), 'api', { details: 'Intro' }), 'text-block')
    expectError(() => addBlock(sampleDoc(), null, { title: 'X', details: 'T', children: [] }), 'text-block')
    expectError(() => groupBlocks(sampleDoc(), ['web'], { title: 'G', details: 'T' }), 'text-block')
    // Removing the text makes room for blocks again
    const back = updateBlock(text, 'web', { details: undefined })
    expect(ids(getLevel(addBlock(back, 'web', { id: 'x', title: 'X' }).document, 'web'))).toEqual(['x'])
  })
})

describe('removeBlock', () => {
  it('removes the subtree and every link touching it', () => {
    const doc = removeBlock(sampleDoc(), 'orders')
    expect(ids(getLevel(doc, 'api'))).toEqual(['auth'])
    expect(findBlock(doc, 'orders-svc')).toBeUndefined()
    expect(doc.links!.map(l => l.id)).toEqual(['l1', 'l2', 'l3'])
    expect(validateDocument(doc).valid).toBe(true)
  })

  it('drops the empty children array and links array', () => {
    let doc = removeBlock(sampleDoc(), 'orders-svc')
    doc = removeBlock(doc, 'orders-queue')
    expect(findBlock(doc, 'orders')).toEqual({ id: 'orders', title: 'Orders', at: 'C1:F1' })

    const bare = removeBlock(createDocument({ blocks: blocks(2), links: [{ id: 'x', from: 'b0', to: 'b1' }] }), 'b0')
    expect(bare).not.toHaveProperty('links')
  })
})

describe('moveBlock', () => {
  it('moves a block with its subtree and keeps links', () => {
    const doc = moveBlock(sampleDoc(), 'orders', null)
    // C1:F1 is taken on the top level: first free place of the same width
    expect(findBlock(doc, 'orders')?.at).toBe('A3:D3')
    expect(ids(doc.blocks)).toEqual(['web', 'api', 'db', 'orders'])
    expect(ids(getLevel(doc, 'api'))).toEqual(['auth'])
    expect(ids(getLevel(doc, 'orders'))).toEqual(['orders-svc', 'orders-queue'])
    expect(doc.links).toHaveLength(5)
    expect(validateDocument(doc).valid).toBe(true)
  })

  it('keeps the place when it is free, or takes the given one', () => {
    expect(findBlock(moveBlock(sampleDoc(), 'auth', null, {}), 'auth')?.at).toBe('A3:B3')
    expect(findBlock(moveBlock(sampleDoc(), 'web', 'orders'), 'web')?.at).toBe('A2:C2')
    expect(findBlock(moveBlock(sampleDoc(), 'auth', null, { at: 'E3:F3' }), 'auth')?.at).toBe('E3:F3')
    expectError(() => moveBlock(sampleDoc(), 'auth', null, { at: 'A2' }), 'overlap')
  })

  it('moves within the same level with "at"', () => {
    const doc = moveBlock(sampleDoc(), 'web', null, { at: 'A3:C3' })
    expect(ids(doc.blocks)).toEqual(['api', 'db', 'web'])
    expect(moveBlock(sampleDoc(), 'web', null)).toEqual(sampleDoc())
  })

  it('refuses to move a block into itself or its descendant', () => {
    expectError(() => moveBlock(sampleDoc(), 'api', 'api'), 'invalid-move')
    expectError(() => moveBlock(sampleDoc(), 'api', 'orders'), 'invalid-move')
  })

  it('refuses to overfill the target level', () => {
    const doc = createDocument({ blocks: [...blocks(5), { id: 'p', title: 'P', at: 'A6', children: blocks(6, 'c') }] })
    expectError(() => moveBlock(doc, 'b0', 'p'), 'too-many-blocks')
  })
})

describe('groupBlocks / ungroupBlock', () => {
  it('covers the members with the group when nothing else is in the way', () => {
    const doc = createDocument({ blocks: blocks(6) })
    const { document, block } = groupBlocks(doc, ['b2', 'b1'], { id: 'g', title: 'Group' })
    expect(block.at).toBe('A2:F3')
    expect(ids(document.blocks)).toEqual(['b0', 'g', 'b3', 'b4', 'b5'])
    // Members keep their arrangement, moved to the corner
    expect(block.children).toEqual([
      { id: 'b1', title: 'Block 1', at: 'A1:F1' },
      { id: 'b2', title: 'Block 2', at: 'A2:F2' },
    ])
    expect(validateDocument(document).valid).toBe(true)
  })

  it('takes the place of the first member when another block is in the way', () => {
    const doc = createDocument({ blocks: blocks(6) })
    const { document, block } = groupBlocks(doc, ['b4', 'b2'], { id: 'g', title: 'Group' })
    expect(block.at).toBe('A3:F3')
    expect(ids(document.blocks)).toEqual(['b0', 'b1', 'g', 'b3', 'b5'])
    expect(block.children!.map(c => c.at)).toEqual(['A1:F1', 'A3:F3'])
    expect(canAddBlock(document, null)).toBe(true)
    expect(groupBlocks(doc, ['b4', 'b2'], { title: 'G', at: 'A5:B5' }).block.at).toBe('A5:B5')
  })

  it('only groups siblings', () => {
    expectError(() => groupBlocks(sampleDoc(), ['web', 'auth'], { title: 'G' }), 'invalid-move')
    expectError(() => groupBlocks(sampleDoc(), [], { title: 'G' }), 'invalid-move')
  })

  it('ungroup puts the children where the group was and drops links of the group', () => {
    let doc = sampleDoc()
    doc = addLink(doc, { id: 'to-api', from: 'db', to: 'api' }).document
    doc = ungroupBlock(doc, 'api')
    // auth fits at D1:E1; orders (4 wide) does not fit next to it and goes to a free row
    expect(ids(doc.blocks)).toEqual(['web', 'auth', 'db', 'orders'])
    expect(doc.blocks.map(b => b.at)).toEqual(['A1:C1', 'D1:E1', 'A2:F2', 'A3:D3'])
    expect(doc.links!.map(l => l.id)).toEqual(['l3', 'l4', 'l5'])
    expect(validateDocument(doc).valid).toBe(true)
  })

  it('ungroup refuses to overfill the level', () => {
    const doc = createDocument({ blocks: [...blocks(5), { id: 'p', title: 'P', at: 'A6', children: blocks(2, 'c') }] })
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
    expectError(() => addLink(sampleDoc(), { from: 'auth', to: 'db' }), 'invalid-link')
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
