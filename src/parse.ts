import { isLegacyDocument, migrateLegacy } from './migrate.js'
import type { TakeSixDocument } from './types.js'
import { validateDocument, type ValidationIssue } from './validate.js'

export type ParseResult =
  | {
      ok: true
      document: TakeSixDocument
      /** Warnings only. */
      issues: ValidationIssue[]
      /** Set when the input was in an older format and was converted. */
      migratedFrom?: 'legacy'
    }
  | { ok: false; issues: ValidationIssue[] }

/**
 * Reads a document from JSON text or an already parsed value: parses,
 * migrates older formats and validates. Never throws.
 */
export function parseDocument(input: string | unknown): ParseResult {
  let value: unknown = input
  if (typeof input === 'string') {
    try {
      value = JSON.parse(input)
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e)
      return { ok: false, issues: [{ severity: 'error', code: 'invalid-type', path: '', message: `Invalid JSON: ${message}` }] }
    }
  }

  let migratedFrom: 'legacy' | undefined
  if (isLegacyDocument(value)) {
    value = migrateLegacy(value)
    migratedFrom = 'legacy'
  }

  const { valid, issues } = validateDocument(value)
  if (!valid) return { ok: false, issues }
  const result: ParseResult = { ok: true, document: value as TakeSixDocument, issues }
  if (migratedFrom) result.migratedFrom = migratedFrom
  return result
}

/** Serializes a document to JSON text (pretty-printed by default). */
export function serializeDocument(doc: TakeSixDocument, { pretty = true }: { pretty?: boolean } = {}): string {
  return JSON.stringify(doc, null, pretty ? 2 : undefined)
}
