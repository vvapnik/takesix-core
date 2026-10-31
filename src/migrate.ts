import { FORMAT_VERSION } from './constants.js'
import type { Block, Link, TakeSixDocument } from './types.js'

/** Pre-1.0 format used by the original takesix app: a bare array of entities. */
export interface LegacyEntity {
  id: string
  icon?: string
  title: string
  description?: string
  layout?: 'tiles' | 'list' | 'circle'
  /** Ids of entities on the same level this one points to. */
  connections?: string[]
  children?: LegacyEntity[]
}

export function isLegacyDocument(input: unknown): input is LegacyEntity[] {
  return Array.isArray(input)
}

/**
 * Converts the legacy entity array into a v1 document. Per-entity
 * `connections` become document-level links with ids `"<from>-><to>"`.
 * A `list` layout becomes full-width children (`size: "F"`); `tiles` and
 * `circle` have no equivalent and keep the default size.
 */
export function migrateLegacy(entities: LegacyEntity[], title = 'Untitled'): TakeSixDocument {
  const links: Link[] = []

  const convert = (list: LegacyEntity[], parentLayout?: LegacyEntity['layout']): Block[] =>
    list.map(e => {
      for (const to of e.connections ?? []) links.push({ id: `${e.id}->${to}`, from: e.id, to })
      const block: Block = { id: e.id, title: e.title }
      if (e.description) block.description = e.description
      if (e.icon) block.icon = e.icon
      if (parentLayout === 'list') block.size = 'F'
      if (e.children?.length) block.children = convert(e.children, e.layout)
      return block
    })

  const blocks = convert(entities)
  const doc: TakeSixDocument = { takesix: FORMAT_VERSION, title, blocks }
  if (links.length) doc.links = links
  return doc
}
