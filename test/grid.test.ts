import { describe, expect, it } from 'vitest'
import { findPlace, fitsGrid, formatArea, overlap, parseArea, readArea, readingOrder } from '../src/index.js'

describe('areas', () => {
  it('reads cells and ranges, both corners included', () => {
    expect(readArea('A1')).toEqual({ col: 0, row: 0, width: 1, height: 1 })
    expect(readArea('B3')).toEqual({ col: 1, row: 2, width: 1, height: 1 })
    expect(readArea('A1:C2')).toEqual({ col: 0, row: 0, width: 3, height: 2 })
    expect(readArea('F6:F6')).toEqual({ col: 5, row: 5, width: 1, height: 1 })
  })

  it('explains what is wrong with a bad value', () => {
    expect(readArea('G1')).toMatch(/columns A–F, rows 1–6/)
    expect(readArea('C2:A1')).toMatch(/ends before it starts/)
    expect(parseArea('A1:B2:C3')).toBeUndefined()
  })

  it('writes areas back', () => {
    for (const at of ['A1', 'B3', 'A1:C2', 'D1:F6']) expect(formatArea(parseArea(at)!)).toBe(at)
  })

  it('finds the first shared cell', () => {
    expect(overlap(parseArea('A1:C2')!, parseArea('B2:E3')!)).toBe('B2')
    expect(overlap(parseArea('A1:C2')!, parseArea('D1:F2')!)).toBeUndefined()
    expect(overlap(parseArea('A1:F1')!, parseArea('A2:F2')!)).toBeUndefined()
  })

  it('knows the bounds of the grid', () => {
    expect(fitsGrid({ col: 3, row: 5, width: 3, height: 1 })).toBe(true)
    expect(fitsGrid({ col: 4, row: 0, width: 3, height: 1 })).toBe(false)
  })
})

describe('readingOrder', () => {
  it('sorts by row, then column, invalid places last', () => {
    const blocks = [{ id: 'c', at: 'A2' }, { id: 'x', at: 'Z9' }, { id: 'b', at: 'D1' }, { id: 'a', at: 'A1:C1' }]
    expect(readingOrder(blocks).map(b => b.id)).toEqual(['a', 'b', 'c', 'x'])
  })
})

describe('findPlace', () => {
  it('scans rows top to bottom and cells left to right', () => {
    expect(findPlace([], 3, 1)).toEqual({ col: 0, row: 0, width: 3, height: 1 })
    const taken = [parseArea('A1:C1')!, parseArea('E1:F2')!]
    expect(findPlace(taken, 1, 1)).toEqual({ col: 3, row: 0, width: 1, height: 1 })
    expect(findPlace(taken, 2, 1)).toEqual({ col: 0, row: 1, width: 2, height: 1 })
    expect(findPlace(taken, 6, 1)).toEqual({ col: 0, row: 2, width: 6, height: 1 })
    expect(findPlace([parseArea('A1:F6')!], 1, 1)).toBeUndefined()
  })
})
