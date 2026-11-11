import { describe, expect, it } from 'vitest'
import { arrowRoute, arrowSegment, crossesArea, levelLayoutIssues, lintLayout, parseArea, type Block, type Link } from '../src/index.js'

const doc = (blocks: Block[], links: Link[]) => ({ takesix: '1.0', title: 'T', blocks, links })
const b = (id: string, at: string, children?: Block[]): Block => (children ? { id, title: id, at, children } : { id, title: id, at })

describe('arrowSegment', () => {
  it('runs straight across shared rows or columns', () => {
    const [p, q] = arrowSegment(parseArea('A1:B2')!, parseArea('D2:F3')!)
    expect(p.y).toBe(q.y)
    expect(p.x).toBeLessThan(q.x)
    const [r, s] = arrowSegment(parseArea('A3:C3')!, parseArea('B1:F1')!)
    expect(r.x).toBe(s.x)
    expect(r.y).toBeGreaterThan(s.y)
  })

  it('goes side to side between blocks that share neither', () => {
    const a = parseArea('A1')!
    const [p, q] = arrowSegment(a, parseArea('C3')!)
    // from A1's right edge to C3's left edge
    expect(p.x).toBe(1)
    expect(q.x).toBe(2.5)
    expect(p.y).toBeLessThan(q.y)
  })

  it('does not count blocks it only touches', () => {
    const segment = arrowSegment(parseArea('A1')!, parseArea('C1')!)
    expect(crossesArea(segment, parseArea('B1')!)).toBe(true)
    expect(crossesArea(segment, parseArea('B2')!)).toBe(false)
  })
})

describe('arrowRoute', () => {
  it('goes around blocks in the way of a straight arrow', () => {
    const start = parseArea('B1:E1')!
    const body = parseArea('A2:F2')!
    const check = parseArea('B3:E3')!
    const route = arrowRoute(check, start, [body])
    expect(route).toHaveLength(3)
    expect(route.some(s => crossesArea(s, body))).toBe(false)
    // beside the wide body, out of the grid on the right
    expect(route[1]![0].x).toBeGreaterThan(7)
  })

  it('stays straight when nothing is in the way', () => {
    expect(arrowRoute(parseArea('A1')!, parseArea('A3')!, [parseArea('B2')!])).toHaveLength(1)
  })
})

describe('lintLayout', () => {
  it('is quiet for a clean layout', () => {
    const d = doc([b('a', 'A1:B1'), b('b', 'C1:D1'), b('c', 'E1:F1')], [{ from: 'a', to: 'b' }, { from: 'b', to: 'c' }])
    expect(lintLayout(d)).toEqual([])
  })

  it('lets a straight arrow go around a block in its way', () => {
    const d = doc([b('a', 'A1:B1'), b('b', 'C1:D1'), b('c', 'E1:F1')], [{ from: 'a', to: 'c' }])
    expect(lintLayout(d)).toEqual([])
    // A loop back up past the body of the loop
    const loop = doc([b('start', 'A1:F1'), b('body', 'A2:F2'), b('check', 'A3:F3')], [{ from: 'check', to: 'start' }])
    expect(lintLayout(loop)).toEqual([])
  })

  it('warns about an arrow running through a third block', () => {
    // a diagonal turns beside "a" and runs level along row 3, through "b"
    const d = doc([b('a', 'A1'), b('b', 'B3'), b('c', 'C3')], [{ from: 'a', to: 'c' }])
    expect(lintLayout(d)).toMatchObject([{ severity: 'warning', code: 'arrow-crosses-block', path: '/blocks' }])
    expect(lintLayout(d)[0]!.message).toMatch(/"a" → "c" has block "b" in its way/)
    // a block on the straight line between them is not in the way of the bent arrow
    expect(lintLayout(doc([b('a', 'A1'), b('b', 'B2'), b('c', 'C3')], [{ from: 'a', to: 'c' }]))).toEqual([])
  })

  it('warns about arrows crossing each other', () => {
    // across a column of blocks, around the one in the middle
    const d = doc([b('a', 'A1'), b('b', 'C1'), b('m', 'B1'), b('c', 'B3')], [{ from: 'a', to: 'b' }, { from: 'm', to: 'c' }])
    expect(lintLayout(d)).toMatchObject([{ code: 'arrows-cross' }])
    // two diagonals in an X turn in the same gap: their lines lie on top of each other
    const x = doc([b('a', 'A1'), b('b', 'B1'), b('c', 'A2'), b('d', 'B2')], [{ from: 'a', to: 'd' }, { from: 'b', to: 'c' }])
    expect(lintLayout(x)).toMatchObject([{ code: 'arrows-cross' }])
  })

  it('checks nested levels, ignoring links across levels', () => {
    const d = doc(
      [b('p', 'A1', [b('x', 'A1'), b('y', 'B3'), b('z', 'C3')]), b('q', 'B1'), b('r', 'C1')],
      [{ from: 'x', to: 'z' }, { from: 'y', to: 'r' }],
    )
    expect(lintLayout(d).map(i => [i.code, i.path])).toEqual([['arrow-crosses-block', '/blocks/0/children']])
  })

  it('names the arrows and blocks of each problem, level by level', () => {
    const d = doc(
      [b('p', 'A1', [b('x', 'A1'), b('y', 'B3'), b('z', 'C3')]), b('q', 'A2'), b('r', 'B2'), b('s', 'A3'), b('t', 'B3')],
      [{ from: 'x', to: 'z' }, { from: 'q', to: 't' }, { from: 'r', to: 's' }],
    )
    expect(levelLayoutIssues(d, null)).toMatchObject([{ code: 'arrows-cross', arrows: ['q|t', 'r|s'], blocks: [] }])
    expect(levelLayoutIssues(d, 'p')).toMatchObject([{ code: 'arrow-crosses-block', arrows: ['x|z'], blocks: ['y'] }])
    expect(levelLayoutIssues(d, 'nope')).toEqual([])
  })
})
