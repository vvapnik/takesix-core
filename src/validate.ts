import { LAYOUTS, LINK_DIRECTIONS, MAX_BLOCKS_PER_LEVEL, SUPPORTED_MAJOR } from './constants.js'
import { buildIndex } from './tree-index.js'
import type { TakeSixDocument } from './types.js'

export type IssueSeverity = 'error' | 'warning'

export type IssueCode =
  | 'invalid-type'
  | 'missing-field'
  | 'unsupported-version'
  | 'too-many-blocks'
  | 'duplicate-id'
  | 'duplicate-link-id'
  | 'unknown-link-endpoint'
  | 'self-link'
  | 'link-never-visible'
  | 'invalid-value'
  | 'unknown-field'

export interface ValidationIssue {
  severity: IssueSeverity
  code: IssueCode
  message: string
  /** JSON Pointer to the offending value, e.g. `/blocks/0/children/3`. */
  path: string
}

export interface ValidationResult {
  /** `true` when there are no errors (warnings are allowed). */
  valid: boolean
  issues: ValidationIssue[]
}

const DOCUMENT_FIELDS = ['takesix', '$schema', 'title', 'description', 'layout', 'blocks', 'links', 'meta']
const BLOCK_FIELDS = ['id', 'title', 'description', 'details', 'icon', 'layout', 'children', 'meta']
const LINK_FIELDS = ['id', 'from', 'to', 'label', 'description', 'direction', 'meta']

type Obj = Record<string, unknown>

const isObject = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)

/**
 * Checks a parsed value against format v1. Works on untrusted input, so it
 * never throws: everything is reported as issues.
 */
export function validateDocument(input: unknown): ValidationResult {
  const issues: ValidationIssue[] = []
  const add = (severity: IssueSeverity, code: IssueCode, path: string, message: string) =>
    issues.push({ severity, code, path, message })
  const error = (code: IssueCode, path: string, message: string) => add('error', code, path, message)

  const checkString = (obj: Obj, key: string, path: string, required: boolean) => {
    const value = obj[key]
    if (value === undefined) {
      if (required) error('missing-field', path, `"${key}" is required`)
      return
    }
    if (typeof value !== 'string') error('invalid-type', `${path}/${key}`, `"${key}" must be a string`)
    else if (required && value.trim() === '') error('invalid-value', `${path}/${key}`, `"${key}" must not be empty`)
  }

  const checkUnknown = (obj: Obj, allowed: string[], path: string) => {
    for (const key of Object.keys(obj)) {
      if (!allowed.includes(key)) add('warning', 'unknown-field', `${path}/${key}`, `Unknown field "${key}"`)
    }
  }

  const checkLayout = (obj: Obj, path: string) => {
    if (obj.layout !== undefined && !LAYOUTS.includes(obj.layout as never)) {
      error('invalid-value', `${path}/layout`, `"layout" must be one of: ${LAYOUTS.join(', ')}`)
    }
  }

  const checkMeta = (obj: Obj, path: string) => {
    if (obj.meta !== undefined && !isObject(obj.meta)) error('invalid-type', `${path}/meta`, '"meta" must be an object')
  }

  if (!isObject(input)) {
    error('invalid-type', '', 'Document must be a JSON object')
    return { valid: false, issues }
  }

  // Version
  const version = input.takesix
  if (version === undefined) {
    error('missing-field', '', '"takesix" version field is required')
  } else if (typeof version !== 'string' || !/^\d+\.\d+$/.test(version)) {
    error('invalid-value', '/takesix', '"takesix" must be a version string like "1.0"')
  } else if (Number(version.split('.')[0]) !== SUPPORTED_MAJOR) {
    error('unsupported-version', '/takesix', `Version ${version} is not supported, expected ${SUPPORTED_MAJOR}.x`)
  }

  checkString(input, 'title', '', true)
  checkString(input, 'description', '', false)
  checkLayout(input, '')
  checkMeta(input, '')
  checkUnknown(input, DOCUMENT_FIELDS, '')

  // Blocks
  const seenIds = new Map<string, string>()

  const checkBlocks = (value: unknown, path: string) => {
    if (!Array.isArray(value)) {
      error('invalid-type', path, 'Blocks must be an array')
      return
    }
    if (value.length > MAX_BLOCKS_PER_LEVEL) {
      error('too-many-blocks', path,
        `${value.length} blocks on one level, at most ${MAX_BLOCKS_PER_LEVEL} allowed. Group some of them into a parent block.`)
    }
    value.forEach((block, i) => {
      const bp = `${path}/${i}`
      if (!isObject(block)) {
        error('invalid-type', bp, 'Block must be an object')
        return
      }
      checkString(block, 'id', bp, true)
      checkString(block, 'title', bp, true)
      checkString(block, 'description', bp, false)
      checkString(block, 'details', bp, false)
      checkString(block, 'icon', bp, false)
      checkLayout(block, bp)
      checkMeta(block, bp)
      checkUnknown(block, BLOCK_FIELDS, bp)

      if (typeof block.id === 'string' && block.id !== '') {
        const first = seenIds.get(block.id)
        if (first !== undefined) error('duplicate-id', `${bp}/id`, `Id "${block.id}" is already used at ${first}`)
        else seenIds.set(block.id, bp)
      }
      if (block.children !== undefined) checkBlocks(block.children, `${bp}/children`)
    })
  }

  if (input.blocks === undefined) error('missing-field', '', '"blocks" is required')
  else checkBlocks(input.blocks, '/blocks')

  // Links
  if (input.links !== undefined) {
    if (!Array.isArray(input.links)) {
      error('invalid-type', '/links', '"links" must be an array')
    } else {
      // Index is only reliable when blocks are structurally sound enough to walk.
      const index = Array.isArray(input.blocks) ? buildIndex(input as unknown as TakeSixDocument) : new Map()
      const seenLinkIds = new Map<string, string>()

      input.links.forEach((link, i) => {
        const lp = `/links/${i}`
        if (!isObject(link)) {
          error('invalid-type', lp, 'Link must be an object')
          return
        }
        checkString(link, 'id', lp, false)
        checkString(link, 'from', lp, true)
        checkString(link, 'to', lp, true)
        checkString(link, 'label', lp, false)
        checkString(link, 'description', lp, false)
        checkMeta(link, lp)
        checkUnknown(link, LINK_FIELDS, lp)
        if (link.direction !== undefined && !LINK_DIRECTIONS.includes(link.direction as never)) {
          error('invalid-value', `${lp}/direction`, `"direction" must be one of: ${LINK_DIRECTIONS.join(', ')}`)
        }

        if (typeof link.id === 'string') {
          const first = seenLinkIds.get(link.id)
          if (first !== undefined) error('duplicate-link-id', `${lp}/id`, `Link id "${link.id}" is already used at ${first}`)
          else seenLinkIds.set(link.id, lp)
        }

        const { from, to } = link
        if (typeof from !== 'string' || typeof to !== 'string') return
        const fromEntry = index.get(from)
        const toEntry = index.get(to)
        if (!fromEntry) error('unknown-link-endpoint', `${lp}/from`, `No block with id "${from}"`)
        if (!toEntry) error('unknown-link-endpoint', `${lp}/to`, `No block with id "${to}"`)
        if (from === to) {
          error('self-link', lp, `Link connects block "${from}" to itself`)
        } else if (fromEntry && toEntry && (fromEntry.path.includes(to) || toEntry.path.includes(from))) {
          add('warning', 'link-never-visible', lp,
            `Link between "${from}" and "${to}" is never shown: one block contains the other`)
        }
      })
    }
  }

  return { valid: !issues.some(i => i.severity === 'error'), issues }
}

/** Formats issues as `path: message` lines, for logs and CLI output. */
export function formatIssues(issues: ValidationIssue[]): string {
  return issues.map(i => `${i.severity} ${i.path || '/'}: ${i.message}`).join('\n')
}
