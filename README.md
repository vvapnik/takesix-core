# @takesix/core

Format and core logic of **takesix**: diagrams and presentations that stay
readable because one screen never holds more than **6 blocks**. Each block can
open into up to 6 more, as deep as needed, with links between any of them.

**Made for AI agents.** Instead of a long wall of text, an agent answers with a
takesix diagram: the gist on one screen, the depth one click away. The format is
small and strict, and the JSON Schema plus `validateDocument` let you check an
agent's answer before anyone reads it.

This package has no dependencies and no UI. It defines the JSON format,
validates and migrates documents, edits them immutably, and works out which
links to draw on each screen. Viewers and editors (such as `@takesix/react`)
build on it.

- Format specification: [FORMAT.md](FORMAT.md)
- JSON Schema: [schema/takesix-1.0.schema.json](schema/takesix-1.0.schema.json)
  (also exported as `@takesix/core/schema.json`)

## Install

```bash
npm install @takesix/core
```

## Usage

```ts
import {
  parseDocument, serializeDocument, formatIssues,
  addBlock, addLink, groupBlocks, getLevel, visibleLinks,
} from '@takesix/core'

// Read: parse + migrate older formats + validate. Never throws.
const result = parseDocument(jsonText)
if (!result.ok) throw new Error(formatIssues(result.issues))
let doc = result.document

// Edit: every helper returns a new document and leaves the old one untouched.
const added = addBlock(doc, 'api', { title: 'Payments', icon: '💳' })
doc = added.document
doc = addLink(doc, { from: added.block.id, to: 'db', label: 'SQL' }).document

// A level is full at 6 blocks: addBlock throws TakeSixError('too-many-blocks').
// The fix is to group some blocks into a new parent:
doc = groupBlocks(doc, ['auth', 'orders'], { title: 'Business logic' }).document

// Render one screen: its blocks and the arrows between them.
const blocks = getLevel(doc, 'api')
const arrows = visibleLinks(doc, 'api')

const json = serializeDocument(doc)
```

## API

| Area | Functions |
|---|---|
| Read / write | `parseDocument`, `serializeDocument`, `validateDocument`, `formatIssues` |
| Migration | `migrateLegacy`, `isLegacyDocument` |
| Queries | `findBlock`, `getPath`, `getLevel`, `canAddBlock`, `buildIndex` |
| Blocks | `createDocument`, `addBlock`, `updateBlock`, `removeBlock`, `moveBlock`, `groupBlocks`, `ungroupBlock` |
| Links | `addLink`, `updateLink`, `removeLink`, `visibleLinks` |
| Misc | `createId`, `TakeSixError`, `MAX_BLOCKS_PER_LEVEL`, `FORMAT_VERSION` |

Query helpers accept an optional prebuilt `buildIndex(doc)` to avoid
re-walking the tree when rendering many things from one document.

## Development

Node 24 LTS (see `.nvmrc`; with nvm: `nvm use`).

```bash
npm install
npm test
npm run build
```

## AI-assisted development

This project is developed with the help of [Claude Code](https://claude.com/claude-code)
(Anthropic). Commits are authored and reviewed by the maintainer.

## License

[MIT](LICENSE)
