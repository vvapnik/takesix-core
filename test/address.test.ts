import { describe, expect, it } from 'vitest'
import { formatViewAddress, parseViewAddress, resolveView, sameView, viewOfPath } from '../src/index.js'
import { sampleDoc } from './fixtures.js'

describe('parseViewAddress', () => {
  it('reads in and at', () => {
    expect(parseViewAddress('#in=api')).toEqual({ in: 'api' })
    expect(parseViewAddress('at=orders')).toEqual({ at: 'orders' })
  })
  it('lives next to takesix data', () => {
    expect(parseViewAddress('#takesix=abc-_&in=orders')).toEqual({ in: 'orders' })
  })
  it('decodes ids', () => {
    expect(parseViewAddress('#at=a%20b%26c')).toEqual({ at: 'a b&c' })
  })
  it('is null without an address', () => {
    expect(parseViewAddress('')).toBeNull()
    expect(parseViewAddress('#takesix=abc')).toBeNull()
    expect(parseViewAddress('#in=')).toBeNull()
  })
})

describe('formatViewAddress', () => {
  it('writes and replaces, keeping other keys', () => {
    expect(formatViewAddress({ in: 'api' })).toBe('#in=api')
    expect(formatViewAddress({ at: 'db' }, '#takesix=abc&in=api')).toBe('#takesix=abc&at=db')
    expect(formatViewAddress(null, '#takesix=abc&in=api')).toBe('#takesix=abc')
    expect(formatViewAddress(null, '#in=api')).toBe('')
  })
  it('round-trips odd ids', () => {
    const view = { at: 'a b&c=d#é' }
    expect(parseViewAddress(formatViewAddress(view))).toEqual(view)
  })
})

describe('resolveView', () => {
  const doc = sampleDoc()
  it('opens the block for in', () => {
    expect(resolveView(doc, { in: 'orders' })).toEqual({ path: ['api', 'orders'] })
  })
  it('opens the level and highlights for at', () => {
    expect(resolveView(doc, { at: 'orders' })).toEqual({ path: ['api'], highlight: 'orders' })
    expect(resolveView(doc, { at: 'web' })).toEqual({ path: [], highlight: 'web' })
  })
  it('treats in on a leaf as at', () => {
    expect(resolveView(doc, { in: 'auth' })).toEqual({ path: ['api'], highlight: 'auth' })
  })
  it('falls back to the top level', () => {
    expect(resolveView(doc, null)).toEqual({ path: [] })
    expect(resolveView(doc, { in: 'missing' })).toEqual({ path: [] })
  })
})

describe('helpers', () => {
  it('viewOfPath and sameView', () => {
    expect(viewOfPath([])).toBeNull()
    expect(viewOfPath(['api', 'orders'])).toEqual({ in: 'orders' })
    expect(sameView({ in: 'a' }, { in: 'a' })).toBe(true)
    expect(sameView({ in: 'a' }, { at: 'a' })).toBe(false)
    expect(sameView(null, null)).toBe(true)
  })
})
