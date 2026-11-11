import { levelAreas, type Area } from './grid.js'
import { visibleLinks, type VisibleLink } from './links.js'
import { getLevel } from './query.js'
import { buildIndex, type TreeIndex } from './tree-index.js'
import type { Block, TakeSixDocument } from './types.js'
import type { ValidationIssue } from './validate.js'

// Layout advice computed from the grid alone, without a browser. Arrows are
// modelled the way the viewer draws them: straight across the rows or
// columns two blocks share, otherwise from the side of one block, turning in
// the gap beside it, to the facing side of the other. Cells are unit squares with a gap between them;
// real rows differ in height, which rarely changes the answer.

interface Point {
  x: number
  y: number
}

type Segment = [Point, Point]

interface Box {
  left: number
  top: number
  right: number
  bottom: number
}

/** Gap between cells, in cell units. */
const GAP = 0.25

const lineStart = (i: number) => i * (1 + GAP)
const lineEnd = (i: number, n: number) => (i + n) * (1 + GAP) - GAP

function box(area: Area): Box {
  return {
    left: lineStart(area.col), right: lineEnd(area.col, area.width),
    top: lineStart(area.row), bottom: lineEnd(area.row, area.height),
  }
}

/** Middle of the cells shared by two ranges `[s1, s1 + n1)` and `[s2, s2 + n2)`, or `undefined`. */
function sharedMiddle(s1: number, n1: number, s2: number, n2: number): number | undefined {
  const start = Math.max(s1, s2)
  const end = Math.min(s1 + n1, s2 + n2)
  return start < end ? (lineStart(start) + lineEnd(start, end - start)) / 2 : undefined
}

/** The line an arrow between two non-overlapping areas roughly follows. */
export function arrowSegment(a: Area, b: Area): Segment {
  const ra = box(a)
  const rb = box(b)
  const y = sharedMiddle(a.row, a.height, b.row, b.height)
  if (y !== undefined) {
    return a.col < b.col ? [{ x: ra.right, y }, { x: rb.left, y }] : [{ x: ra.left, y }, { x: rb.right, y }]
  }
  const x = sharedMiddle(a.col, a.width, b.col, b.width)
  if (x === undefined) {
    // Diagonal: from the side of one block to the facing side of the other
    const ay = (ra.top + ra.bottom) / 2
    const by = (rb.top + rb.bottom) / 2
    return a.col < b.col ? [{ x: ra.right, y: ay }, { x: rb.left, y: by }] : [{ x: ra.left, y: ay }, { x: rb.right, y: by }]
  }
  return b.row > a.row
    ? [{ x, y: ra.bottom }, { x, y: rb.top }]
    : [{ x, y: ra.top }, { x, y: rb.bottom }]
}

/**
 * The lines an arrow between two areas follows, given the other blocks of the
 * level. Like {@link arrowSegment}, except that a diagonal arrow turns in the
 * gap beside the block it leaves and runs level into the other, and a
 * straight arrow with a block in its way goes around it, as the viewer draws it: blocks sharing rows by
 * the gap below them, blocks sharing columns (a loop back up, say) by the gap
 * beside them, on the side that crosses fewer blocks, then the one with fewer
 * blocks beside it, then the shorter one. Viewers keep room beside the outer
 * columns for it.
 */
export function arrowRoute(a: Area, b: Area, others: Area[]): Segment[] {
  const straight = arrowSegment(a, b)
  const blocking = others.filter(o => crossesArea(straight, o))
  const shareRows = sharedMiddle(a.row, a.height, b.row, b.height) !== undefined
  const shareCols = sharedMiddle(a.col, a.width, b.col, b.width) !== undefined
  const ra = box(a)
  const rb = box(b)
  if (!shareRows && !shareCols) {
    // Diagonal: the viewer turns in the gap beside the block the arrow leaves,
    // then runs level into the other
    const [p, q] = straight
    const x = a.col < b.col ? ra.right + GAP / 2 : ra.left - GAP / 2
    return [[p, { x, y: p.y }], [{ x, y: p.y }, { x, y: q.y }], [{ x, y: q.y }, q]]
  }
  if (!blocking.length) return [straight]
  const boxes = [ra, rb, ...blocking.map(box)]
  const via = (p: Point, q: Point, lane: Point, horizontal: boolean): Segment[] => {
    // horizontal: the lane is a column x = lane.x; otherwise a row y = lane.y
    const p2 = horizontal ? { x: lane.x, y: p.y } : { x: p.x, y: lane.y }
    const q2 = horizontal ? { x: lane.x, y: q.y } : { x: q.x, y: lane.y }
    return [[p, p2], [p2, q2], [q2, q]]
  }
  if (shareRows) {
    const lane = Math.max(...boxes.map(r => r.bottom)) + GAP / 2
    const p = { x: (ra.left + ra.right) / 2, y: ra.bottom }
    const q = { x: (rb.left + rb.right) / 2, y: rb.bottom }
    return via(p, q, { x: 0, y: lane }, false)
  }
  const ay = (ra.top + ra.bottom) / 2
  const by = (rb.top + rb.bottom) / 2
  const right = via({ x: ra.right, y: ay }, { x: rb.right, y: by }, { x: Math.max(...boxes.map(r => r.right)) + GAP / 2, y: 0 }, true)
  const left = via({ x: ra.left, y: ay }, { x: rb.left, y: by }, { x: Math.min(...boxes.map(r => r.left)) - GAP / 2, y: 0 }, true)
  const crossed = (route: Segment[]) => others.filter(o => route.some(s => crossesArea(s, o))).length
  const length = (route: Segment[]) => route.reduce((n, [p, q]) => n + Math.abs(q.x - p.x) + Math.abs(q.y - p.y), 0)
  // Blocks beside the detour's rows on that side: their arrows are likely in the way
  const top = Math.min(...boxes.map(r => r.top))
  const bottom = Math.max(...boxes.map(r => r.bottom))
  const beside = (side: 'left' | 'right') => others.map(box).filter(o => o.top < bottom && o.bottom > top &&
    (side === 'right' ? o.left >= Math.max(...boxes.map(r => r.right)) : o.right <= Math.min(...boxes.map(r => r.left)))).length
  // Viewers keep room beside the outer columns for the detour
  const score = (route: Segment[], side: 'left' | 'right') => crossed(route) * 1000 + beside(side) * 100 + length(route)
  return score(left, 'left') < score(right, 'right') ? left : right
}

/** Whether a segment passes through the inside of an area (touching an edge does not count). */
export function crossesArea([p, q]: Segment, area: Area): boolean {
  const e = 0.01
  const r = box(area)
  const left = r.left + e
  const right = r.right - e
  const top = r.top + e
  const bottom = r.bottom - e
  // Liang–Barsky clipping
  let t0 = 0
  let t1 = 1
  const dx = q.x - p.x
  const dy = q.y - p.y
  const edges: Array<[number, number]> = [[-dx, p.x - left], [dx, right - p.x], [-dy, p.y - top], [dy, bottom - p.y]]
  for (const [pe, qe] of edges) {
    if (pe === 0) {
      if (qe < 0) return false
      continue
    }
    const t = qe / pe
    if (pe < 0) t0 = Math.max(t0, t)
    else t1 = Math.min(t1, t)
    if (t0 > t1) return false
  }
  return true
}

const cross = (o: Point, a: Point, b: Point) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x)

/** Whether two segments cross at a single point inside both (shared ends and collinear runs do not count). */
export function segmentsCross([a, b]: Segment, [c, d]: Segment): boolean {
  const d1 = cross(c, d, a)
  const d2 = cross(c, d, b)
  const d3 = cross(a, b, c)
  const d4 = cross(a, b, d)
  return d1 * d2 < 0 && d3 * d4 < 0
}

/** Whether two axis-aligned segments run along one line and share a stretch of it. */
function segmentsOverlap([a, b]: Segment, [c, d]: Segment): boolean {
  const e = 0.01
  const along = (p1: number, p2: number, q1: number, q2: number) =>
    Math.min(Math.max(p1, p2), Math.max(q1, q2)) - Math.max(Math.min(p1, p2), Math.min(q1, q2)) > e
  if (a.x === b.x && c.x === d.x && Math.abs(a.x - c.x) < e) return along(a.y, b.y, c.y, d.y)
  if (a.y === b.y && c.y === d.y && Math.abs(a.y - c.y) < e) return along(a.x, b.x, c.x, d.x)
  return false
}

/** A layout problem on one level, with the arrows and blocks it concerns. */
export interface LayoutIssue {
  code: 'arrow-crosses-block' | 'arrows-cross'
  message: string
  /** Keys of the arrows involved, as in {@link VisibleLink.key}. */
  arrows: string[]
  /** Blocks an arrow runs through. */
  blocks: string[]
}

/**
 * Layout problems of the screen of `parentId` (`null` = top level): arrows
 * that run through a third block (after going around the blocks in the way
 * of a straight arrow, see {@link arrowRoute}) and arrows that cross each
 * other. Editors show them next to the arrows.
 */
export function levelLayoutIssues(
  doc: TakeSixDocument,
  parentId: string | null,
  index: TreeIndex = buildIndex(doc),
): LayoutIssue[] {
  const areas = levelAreas(getLevel(doc, parentId, index))
  const arrows = visibleLinks(doc, parentId, index).flatMap(link => {
    const a = areas.get(link.from)
    const b = areas.get(link.to)
    if (!a || !b) return []
    const others = [...areas].filter(([id]) => id !== link.from && id !== link.to).map(([, area]) => area)
    return [{ link, route: arrowRoute(a, b, others) }]
  })
  const name = (link: VisibleLink) => `"${link.from}" → "${link.to}"`
  const issues: LayoutIssue[] = []

  for (const { link, route } of arrows) {
    for (const [id, area] of areas) {
      if (id === link.from || id === link.to || !route.some(s => crossesArea(s, area))) continue
      issues.push({
        code: 'arrow-crosses-block',
        message: `Arrow ${name(link)} has block "${id}" in its way: place the two blocks next to each other`,
        arrows: [link.key],
        blocks: [id],
      })
    }
  }
  arrows.forEach((first, i) => {
    for (const second of arrows.slice(i + 1)) {
      const shared = [first.link.from, first.link.to].some(id => id === second.link.from || id === second.link.to)
      if (shared || !first.route.some(s => second.route.some(t => segmentsCross(s, t) || segmentsOverlap(s, t)))) continue
      issues.push({
        code: 'arrows-cross',
        message: `Arrows ${name(first.link)} and ${name(second.link)} cross`,
        arrows: [first.link.key, second.link.key],
        blocks: [],
      })
    }
  })
  return issues
}

/**
 * Layout advice for a whole valid document: {@link levelLayoutIssues} of
 * every level. Only warnings: the document is fine, but its screens are
 * harder to read. Paths point at the level.
 */
export function lintLayout(doc: TakeSixDocument): ValidationIssue[] {
  const index = buildIndex(doc)
  const issues: ValidationIssue[] = []
  const checkLevel = (parentId: string | null, blocks: Block[], path: string) => {
    for (const { code, message } of levelLayoutIssues(doc, parentId, index)) {
      issues.push({ severity: 'warning', code, message, path })
    }
    blocks.forEach((block, i) => {
      if (block.children?.length) checkLevel(block.id, block.children, `${path}/${i}/children`)
    })
  }
  checkLevel(null, doc.blocks, '/blocks')
  return issues
}
