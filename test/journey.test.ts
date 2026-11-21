import { describe, expect, it } from 'vitest'
import {
  addJourney,
  addJourneyStep,
  findJourney,
  formatJourneyAddress,
  formatViewAddress,
  moveJourneyStep,
  parseJourneyAddress,
  parseViewAddress,
  removeBlock,
  removeJourney,
  removeJourneyStep,
  stepView,
  TakeSixError,
  ungroupBlock,
  updateJourney,
  updateJourneyStep,
  validateDocument,
  viewStep,
  type TakeSixDocument,
} from '../src/index.js'
import { sampleDoc } from './fixtures.js'

function withTour(): TakeSixDocument {
  return {
    ...sampleDoc(),
    journeys: [{
      id: 'tour',
      title: 'Tour',
      steps: [{ at: 'web' }, { in: 'api', label: 'API', duration: 4, notes: '**Look** here' }, { in: 'orders' }],
    }],
  }
}

describe('journey addresses', () => {
  it('reads journey and step (from 1 in the URL, from 0 here)', () => {
    expect(parseJourneyAddress('#journey=tour&step=2')).toEqual({ journey: 'tour', step: 1 })
    expect(parseJourneyAddress('#takesix=abc&in=api&journey=a%20b&step=3')).toEqual({ journey: 'a b', step: 2 })
  })
  it('reads a missing or broken step as the first', () => {
    expect(parseJourneyAddress('#journey=tour')).toEqual({ journey: 'tour', step: 0 })
    expect(parseJourneyAddress('#journey=tour&step=0')).toEqual({ journey: 'tour', step: 0 })
    expect(parseJourneyAddress('#journey=tour&step=x')).toEqual({ journey: 'tour', step: 0 })
  })
  it('is null without a journey', () => {
    expect(parseJourneyAddress('#in=api')).toBeNull()
    expect(parseJourneyAddress('#journey=')).toBeNull()
  })
  it('writes and removes, keeping other keys', () => {
    expect(formatJourneyAddress({ journey: 'tour', step: 0 })).toBe('#journey=tour&step=1')
    expect(formatJourneyAddress({ journey: 'a b', step: 4 }, '#takesix=x&in=api&journey=old&step=9'))
      .toBe('#takesix=x&in=api&journey=a%20b&step=5')
    expect(formatJourneyAddress(null, '#in=api&journey=tour&step=2')).toBe('#in=api')
    expect(formatJourneyAddress(null, '#journey=tour&step=2')).toBe('')
  })
  it('lives next to the view address', () => {
    const hash = formatViewAddress({ in: 'orders' }, '#journey=tour&step=3')
    expect(parseViewAddress(hash)).toEqual({ in: 'orders' })
    expect(parseJourneyAddress(hash)).toEqual({ journey: 'tour', step: 2 })
  })
})

describe('stepView', () => {
  it('turns a step into a view address', () => {
    expect(stepView({ in: 'api', label: 'x' })).toEqual({ in: 'api' })
    expect(stepView({ at: 'db' })).toEqual({ at: 'db' })
    expect(stepView({ label: 'Overview' })).toBeNull()
  })
  it('turns a view address into a step', () => {
    expect(viewStep({ in: 'api' })).toEqual({ in: 'api' })
    expect(viewStep({ at: 'db' })).toEqual({ at: 'db' })
    expect(viewStep(null)).toEqual({})
  })
})

describe('journey editing', () => {
  it('adds, renames and removes journeys', () => {
    const { document, journey } = addJourney(sampleDoc(), { title: 'New journey' })
    expect(journey.steps).toEqual([])
    expect(findJourney(document, journey.id)).toBe(journey)
    const renamed = updateJourney(document, journey.id, { title: 'Intro', description: 'For newcomers' })
    expect(findJourney(renamed, journey.id)).toMatchObject({ title: 'Intro', description: 'For newcomers', steps: [] })
    expect(removeJourney(renamed, journey.id).journeys).toBeUndefined()
  })
  it('rejects a taken id and unknown journeys', () => {
    expect(() => addJourney(withTour(), { id: 'tour', title: 'Again' })).toThrow(TakeSixError)
    expect(() => updateJourney(withTour(), 'nope', { title: 'x' })).toThrow(TakeSixError)
    expect(() => removeJourneyStep(withTour(), 'tour', 7)).toThrow(TakeSixError)
  })
  it('adds, replaces and removes steps', () => {
    let doc = addJourneyStep(withTour(), 'tour', { at: 'db' })
    doc = addJourneyStep(doc, 'tour', { in: 'auth' }, 0)
    expect(findJourney(doc, 'tour')!.steps.map(stepView)).toEqual([
      { in: 'auth' }, { at: 'web' }, { in: 'api' }, { in: 'orders' }, { at: 'db' },
    ])
    doc = updateJourneyStep(doc, 'tour', 0, { at: 'auth', label: 'Auth' })
    doc = removeJourneyStep(doc, 'tour', 1)
    expect(findJourney(doc, 'tour')!.steps[0]).toEqual({ at: 'auth', label: 'Auth' })
    expect(findJourney(doc, 'tour')!.steps).toHaveLength(4)
  })
  it('moves a step', () => {
    const order = (doc: TakeSixDocument) => findJourney(doc, 'tour')!.steps.map(stepView)
    expect(order(moveJourneyStep(withTour(), 'tour', 0, 2))).toEqual([{ in: 'api' }, { in: 'orders' }, { at: 'web' }])
    expect(order(moveJourneyStep(withTour(), 'tour', 2, 0))).toEqual([{ in: 'orders' }, { at: 'web' }, { in: 'api' }])
    expect(order(moveJourneyStep(withTour(), 'tour', 1, 9))).toEqual([{ at: 'web' }, { in: 'orders' }, { in: 'api' }])
    const doc = withTour()
    expect(moveJourneyStep(doc, 'tour', 1, 1)).toBe(doc)
    expect(() => moveJourneyStep(doc, 'tour', 5, 0)).toThrow(TakeSixError)
  })
  it('drops steps to removed blocks, keeping the journey', () => {
    const doc = removeBlock(addJourneyStep(withTour(), 'tour', {}, 0), 'api')
    expect(findJourney(doc, 'tour')!.steps).toEqual([{}, { at: 'web' }])
    const empty = removeBlock(removeBlock(withTour(), 'api'), 'web')
    expect(findJourney(empty, 'tour')!.steps).toEqual([])
  })
  it('drops steps to an ungrouped block only', () => {
    const doc = ungroupBlock(withTour(), 'orders')
    expect(findJourney(doc, 'tour')!.steps.map(stepView)).toEqual([{ at: 'web' }, { in: 'api' }])
  })
})

describe('journey validation', () => {
  const codes = (doc: unknown) => validateDocument(doc).issues.map(i => `${i.severity} ${i.code} ${i.path}`)

  it('accepts a journey', () => {
    expect(validateDocument(withTour())).toEqual({ valid: true, issues: [] })
  })
  it('accepts an empty journey', () => {
    expect(validateDocument({ ...sampleDoc(), journeys: [{ id: 'j', title: 'J', steps: [] }] }).valid).toBe(true)
  })
  it('checks step targets', () => {
    const doc = withTour()
    doc.journeys![0]!.steps.push({ in: 'nope' })
    expect(codes(doc)).toEqual(['error unknown-step-target /journeys/0/steps/3/in'])
  })
  it('wants at most one of in and at; neither is the top level', () => {
    expect(codes({ ...sampleDoc(), journeys: [{ id: 'j', title: 'J', steps: [{ in: 'api', at: 'web' }, { label: 'Overview' }] }] }))
      .toEqual(['error invalid-value /journeys/0/steps/0'])
  })
  it('checks ids, fields and durations', () => {
    expect(codes({
      ...sampleDoc(),
      journeys: [
        { id: 'j', title: 'J', steps: [{ at: 'web', duration: 0, colour: 'red' }] },
        { id: 'j', title: '', steps: {} },
        { id: 'k', title: 'K' },
        'x',
      ],
    })).toEqual([
      'warning unknown-field /journeys/0/steps/0/colour',
      'error invalid-value /journeys/0/steps/0/duration',
      'error invalid-value /journeys/1/title',
      'error duplicate-journey-id /journeys/1/id',
      'error invalid-type /journeys/1/steps',
      'error missing-field /journeys/2',
      'error invalid-type /journeys/3',
    ])
    expect(codes({ ...sampleDoc(), journeys: {} })).toEqual(['error invalid-type /journeys'])
  })
})
