import type { TakeSixDocument } from './types.js'
import { validateDocument, type ValidationIssue } from './validate.js'

export type ParseResult =
  | {
      ok: true
      document: TakeSixDocument
      /** Warnings only. */
      issues: ValidationIssue[]
    }
  | { ok: false; issues: ValidationIssue[] }

/**
 * Reads a document from JSON text or an already parsed value: parses and
 * validates. Never throws.
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

  const { valid, issues } = validateDocument(value)
  if (!valid) return { ok: false, issues }
  return { ok: true, document: value as TakeSixDocument, issues }
}

/** Serializes a document to JSON text (pretty-printed by default). */
export function serializeDocument(doc: TakeSixDocument, { pretty = true }: { pretty?: boolean } = {}): string {
  return JSON.stringify(doc, null, pretty ? 2 : undefined)
}
