/**
 * Journeys: guided tours through a diagram, one screen after another.
 *
 * Editing helpers here are immutable like those in `edit.ts`.
 *
 * @module
 */
import type { ViewAddress } from './address.js'
import { TakeSixError } from './errors.js'
import { createId } from './id.js'
import type { Journey, JourneyStep, TakeSixDocument } from './types.js'

/** A step of a journey in a URL: `#journey=<id>&step=<n>`, `step` counted from 0 here. */
export interface JourneyAddress {
  journey: string
  step: number
}

const JOURNEY = 'journey'
const STEP = 'step'

/** Editable journey fields. A key set to `undefined` removes that field. */
export type JourneyChanges = Partial<Omit<Journey, 'id' | 'steps'>>

/** A journey to add; steps default to none. */
export type NewJourney = Omit<Journey, 'id' | 'steps'> & { id?: string; steps?: JourneyStep[] }

/** The screen a step shows, as a view address. */
export function stepView(step: JourneyStep): ViewAddress {
  if (step.in !== undefined) return { in: step.in }
  if (step.at !== undefined) return { at: step.at }
  return null
}

/** The step showing a screen, keeping nothing else. */
export function viewStep(view: ViewAddress): JourneyStep {
  if (view === null) return {}
  return 'in' in view ? { in: view.in } : { at: view.at }
}

/** The block a step points at; `undefined` for the top level. */
export function stepTarget(step: JourneyStep): string | undefined {
  return step.in ?? step.at
}

/** The journey with this id, if the document has it. */
export function findJourney(doc: TakeSixDocument, id: string): Journey | undefined {
  return doc.journeys?.find(j => j.id === id)
}

// URL fragment keys, kept separate from the view address keys (address.ts)
function pairs(hash: string): [string, string][] {
  return hash.replace(/^#/, '').split('&').filter(Boolean).map(part => {
    const eq = part.indexOf('=')
    return eq === -1 ? [part, ''] : [part.slice(0, eq), part.slice(eq + 1)]
  })
}

/**
 * Reads a journey step from a URL fragment (`#journey=<id>&step=<n>`, `n`
 * from 1; other keys may sit next to it). `step` in the result counts from 0;
 * a missing or broken step number reads as the first step. `null` when the
 * fragment names no journey.
 */
export function parseJourneyAddress(hash: string): JourneyAddress | null {
  const all = pairs(hash)
  const raw = all.find(([k]) => k === JOURNEY)?.[1]
  if (!raw) return null
  let journey: string
  try {
    journey = decodeURIComponent(raw.replace(/\+/g, ' '))
  } catch {
    return null
  }
  const n = Number(all.find(([k]) => k === STEP)?.[1])
  return { journey, step: Number.isInteger(n) && n >= 1 ? n - 1 : 0 }
}

/**
 * Writes a journey step into a URL fragment, keeping its other keys; `null`
 * removes it. Returns the fragment with a leading `#`, or `''` when nothing
 * is left.
 */
export function formatJourneyAddress(address: JourneyAddress | null, hash = ''): string {
  const parts = pairs(hash).filter(([k]) => k !== JOURNEY && k !== STEP).map(([k, v]) => `${k}=${v}`)
  if (address) parts.push(`${JOURNEY}=${encodeURIComponent(address.journey)}`, `${STEP}=${address.step + 1}`)
  return parts.length ? `#${parts.join('&')}` : ''
}

function withJourneys(doc: TakeSixDocument, journeys: Journey[]): TakeSixDocument {
  const { journeys: _, ...rest } = doc
  return journeys.length ? { ...rest, journeys } : rest
}

function requireJourney(doc: TakeSixDocument, id: string): Journey {
  const journey = findJourney(doc, id)
  if (!journey) throw new TakeSixError('not-found', `No journey with id "${id}"`)
  return journey
}

function replaceJourney(doc: TakeSixDocument, journey: Journey, next: Journey): TakeSixDocument {
  return withJourneys(doc, (doc.journeys ?? []).map(j => (j === journey ? next : j)))
}

export function addJourney(doc: TakeSixDocument, input: NewJourney): { document: TakeSixDocument; journey: Journey } {
  const journeys = doc.journeys ?? []
  const journey: Journey = { ...input, id: input.id ?? createId('j'), steps: input.steps ?? [] }
  if (journeys.some(j => j.id === journey.id)) throw new TakeSixError('duplicate-id', `Journey id "${journey.id}" is already used`)
  return { document: withJourneys(doc, [...journeys, journey]), journey }
}

export function updateJourney(doc: TakeSixDocument, id: string, changes: JourneyChanges): TakeSixDocument {
  const journey = requireJourney(doc, id)
  const next = { ...journey } as Record<string, unknown>
  for (const [key, value] of Object.entries(changes)) {
    if (key === 'id' || key === 'steps') continue
    if (value === undefined) delete next[key]
    else next[key] = value
  }
  return replaceJourney(doc, journey, next as unknown as Journey)
}

export function removeJourney(doc: TakeSixDocument, id: string): TakeSixDocument {
  requireJourney(doc, id)
  return withJourneys(doc, (doc.journeys ?? []).filter(j => j.id !== id))
}

/** Adds a step at `index` (default: the end). */
export function addJourneyStep(doc: TakeSixDocument, journeyId: string, step: JourneyStep, index?: number): TakeSixDocument {
  const journey = requireJourney(doc, journeyId)
  const steps = [...journey.steps]
  steps.splice(index ?? steps.length, 0, step)
  return replaceJourney(doc, journey, { ...journey, steps })
}

/** Replaces the step at `index`. */
export function updateJourneyStep(doc: TakeSixDocument, journeyId: string, index: number, step: JourneyStep): TakeSixDocument {
  const journey = requireJourney(doc, journeyId)
  if (!journey.steps[index]) throw new TakeSixError('not-found', `Journey "${journeyId}" has no step ${index + 1}`)
  return replaceJourney(doc, journey, { ...journey, steps: journey.steps.map((s, i) => (i === index ? step : s)) })
}

export function removeJourneyStep(doc: TakeSixDocument, journeyId: string, index: number): TakeSixDocument {
  const journey = requireJourney(doc, journeyId)
  if (!journey.steps[index]) throw new TakeSixError('not-found', `Journey "${journeyId}" has no step ${index + 1}`)
  return replaceJourney(doc, journey, { ...journey, steps: journey.steps.filter((_, i) => i !== index) })
}

/** Moves the step at `from` to position `to` (both from 0); the others close up around it. */
export function moveJourneyStep(doc: TakeSixDocument, journeyId: string, from: number, to: number): TakeSixDocument {
  const journey = requireJourney(doc, journeyId)
  const step = journey.steps[from]
  if (!step) throw new TakeSixError('not-found', `Journey "${journeyId}" has no step ${from + 1}`)
  const target = Math.max(0, Math.min(to, journey.steps.length - 1))
  if (target === from) return doc
  const steps = journey.steps.filter((_, i) => i !== from)
  steps.splice(target, 0, step)
  return replaceJourney(doc, journey, { ...journey, steps })
}

/** Drops the steps that point at removed blocks; journeys themselves stay, even when emptied. */
export function dropStepsTo(doc: TakeSixDocument, removed: ReadonlySet<string>): TakeSixDocument {
  const gone = (s: JourneyStep) => { const t = stepTarget(s); return t !== undefined && removed.has(t) }
  if (!doc.journeys?.some(j => j.steps.some(gone))) return doc
  return withJourneys(doc, doc.journeys.map(j => {
    const steps = j.steps.filter(s => !gone(s))
    return steps.length === j.steps.length ? j : { ...j, steps }
  }))
}
