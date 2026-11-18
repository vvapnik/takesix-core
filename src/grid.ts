import { GRID_SIZE } from './constants.js'
import type { Block } from './types.js'

/**
 * A rectangle of cells on a level's 6×6 grid. Zero-based: column 0 is `A`,
 * row 0 is `1`. Written in documents as `"A1:C2"` (see {@link parseArea}).
 */
export interface Area {
  col: number
  row: number
  width: number
  height: number
}

const CELL = /^([A-Z])(\d+)$/

function parseCell(cell: string): { col: number; row: number } | undefined {
  const m = CELL.exec(cell)
  if (!m) return undefined
  const col = m[1]!.charCodeAt(0) - 65
  const row = Number(m[2]) - 1
  if (col >= GRID_SIZE || row < 0 || row >= GRID_SIZE) return undefined
  return { col, row }
}

/**
 * Reads an `at` value: one cell (`"B3"`) or a range of cells, both corners
 * included (`"A1:C2"`). Returns a message instead of an area when the value
 * is malformed, so the validator can say what is wrong.
 */
export function readArea(at: string): Area | string {
  const [first, last, extra] = at.split(':')
  const start = parseCell(first!)
  const end = last === undefined ? start : parseCell(last)
  if (extra !== undefined || !start || !end) {
    return `"${at}" is not a cell like "B3" or a range like "A1:C2" (columns A–F, rows 1–6)`
  }
  if (end.col < start.col || end.row < start.row) {
    return `"${at}" ends before it starts: write the top-left cell first`
  }
  return { col: start.col, row: start.row, width: end.col - start.col + 1, height: end.row - start.row + 1 }
}

/** The area of an `at` value, or `undefined` when it is malformed. */
export function parseArea(at: string): Area | undefined {
  const area = readArea(at)
  return typeof area === 'string' ? undefined : area
}

const cellName = (col: number, row: number) => `${String.fromCharCode(65 + col)}${row + 1}`

/** Writes an area as an `at` value: `"B3"` for one cell, `"A1:C2"` otherwise. */
export function formatArea({ col, row, width, height }: Area): string {
  const start = cellName(col, row)
  return width === 1 && height === 1 ? start : `${start}:${cellName(col + width - 1, row + height - 1)}`
}

/** The top-left cell two areas share, e.g. `"B2"`, or `undefined` if they do not overlap. */
export function overlap(a: Area, b: Area): string | undefined {
  const col = Math.max(a.col, b.col)
  const row = Math.max(a.row, b.row)
  if (col >= Math.min(a.col + a.width, b.col + b.width) || row >= Math.min(a.row + a.height, b.row + b.height)) return undefined
  return cellName(col, row)
}

/** Whether an area lies inside the grid. */
export function fitsGrid(area: Area): boolean {
  return area.col >= 0 && area.row >= 0 && area.width >= 1 && area.height >= 1 &&
    area.col + area.width <= GRID_SIZE && area.row + area.height <= GRID_SIZE
}

/** Areas of the blocks of one level, skipping blocks whose `at` is malformed. */
export function levelAreas(blocks: Block[]): Map<string, Area> {
  const areas = new Map<string, Area>()
  for (const block of blocks) {
    const area = typeof block.at === 'string' ? parseArea(block.at) : undefined
    if (area) areas.set(block.id, area)
  }
  return areas
}

/**
 * Blocks of one level in reading order: by row, then by column. This is the
 * order for text versions, screen readers and keyboard navigation; the order
 * of the array in the file means nothing. Blocks without a valid `at` go last.
 */
export function readingOrder<T extends Pick<Block, 'at'>>(blocks: T[]): T[] {
  const key = (b: T) => {
    const area = typeof b.at === 'string' ? parseArea(b.at) : undefined
    return area ? area.row * GRID_SIZE + area.col : Infinity
  }
  return blocks
    .map((block, i) => ({ block, i, k: key(block) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map(e => e.block)
}

/**
 * The first free place for a `width` × `height` area among `taken`, scanning
 * rows top to bottom and cells left to right. `undefined` when it fits nowhere.
 */
export function findPlace(taken: Iterable<Area>, width: number, height: number): Area | undefined {
  const occupied = [...taken]
  for (let row = 0; row + height <= GRID_SIZE; row++) {
    for (let col = 0; col + width <= GRID_SIZE; col++) {
      const area = { col, row, width, height }
      if (occupied.every(o => !overlap(o, area))) return area
    }
  }
  return undefined
}
