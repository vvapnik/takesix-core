# @takesix/core

> TakeSix is an open format and libraries that let an AI agent answer with a diagram you can click into instead of a wall of text: at most six blocks per screen, and any block opens into up to six more.
> **[takesix.vapnik.de](https://takesix.vapnik.de/)** · [FAQ](https://takesix.vapnik.de/faq/)

[![A TakeSix diagram of a web app architecture: a click zooms into a block, into one of its parts, into its text, and back to the top.](https://takesix.vapnik.de/demo.gif)](https://takesix.vapnik.de/examples/architecture/)

Format and core logic of **takesix**: diagrams and presentations that stay
readable because one screen never holds more than **6 blocks**. Each block can
open into up to 6 more, as deep as needed, with links between any of them.

**Made for AI agents.** Instead of a long wall of text, an agent answers with a
takesix diagram: the gist on one screen, the depth one click away. The format is
small and strict, and the JSON Schema plus `validateDocument` let you check an
agent's answer before anyone reads it.

This package has no dependencies and no UI. It defines the JSON format,
validates documents, places blocks on each level's 6×6 grid, edits them
immutably, and works out which links to draw on each screen. Viewers and editors (such as `@takesix/react`)
build on it.

- Format specification: [FORMAT.md](FORMAT.md)
- JSON Schema: [schema/takesix-1.0.schema.json](schema/takesix-1.0.schema.json)
  (also exported as `@takesix/core/schema.json`)

## Examples

Live on the site, each with its `.takesix.json` and the prompt that gets one
like it from an agent:

| Example | What it shows |
|---|---|
| [Architecture](https://takesix.vapnik.de/examples/architecture/) | A SaaS web app layer by layer, from the clients down to the data |
| [Data model](https://takesix.vapnik.de/examples/data-model/) | A shop database: the tables and their relations, the columns inside |
| [Presentation](https://takesix.vapnik.de/examples/presentation/) | A team talk: the parts in order, slides and speaker notes inside |
| [To-do list](https://takesix.vapnik.de/examples/todo/) | A website launch in stages, a status on every task |

Smaller documents, one layout each, are in [examples/](examples/).

## Install

```bash
npm install @takesix/core
```

## Usage

```ts
import {
  parseDocument, serializeDocument, formatIssues,
  addBlock, addLink, groupBlocks, getLevel, visibleLinks, lintLayout,
} from '@takesix/core'

// Read: parse + validate. Never throws.
const result = parseDocument(jsonText)
if (!result.ok) throw new Error(formatIssues(result.issues))
let doc = result.document

// Edit: every helper returns a new document and leaves the old one untouched.
// Without `at`, a new block goes to the first free place on the grid.
const added = addBlock(doc, 'api', { title: 'Payments', icon: '💳', at: 'A2:C2' })
doc = added.document
doc = addLink(doc, { from: added.block.id, to: 'db', label: 'SQL' }).document

// A level is full at 6 blocks: addBlock throws TakeSixError('too-many-blocks').
// The fix is to group some blocks into a new parent:
doc = groupBlocks(doc, ['auth', 'orders'], { title: 'Business logic' }).document

// Render one screen: its blocks and the arrows between them.
const blocks = getLevel(doc, 'api')
const arrows = visibleLinks(doc, 'api')

// Layout advice: arrows through other blocks, crossing arrows.
const advice = lintLayout(doc)

const json = serializeDocument(doc)
```

## API

| Area | Functions |
|---|---|
| Read / write | `parseDocument`, `serializeDocument`, `validateDocument`, `formatIssues` |
| Grid | `parseArea`, `readArea`, `formatArea`, `overlap`, `fitsGrid`, `findPlace`, `levelAreas`, `readingOrder`, `lintLayout` |
| Queries | `findBlock`, `getPath`, `getLevel`, `canAddBlock`, `buildIndex` |
| Blocks | `createDocument`, `addBlock`, `updateBlock`, `removeBlock`, `moveBlock`, `groupBlocks`, `ungroupBlock` |
| Links | `addLink`, `updateLink`, `removeLink`, `visibleLinks` |
| Misc | `createId`, `TakeSixError`, `MAX_BLOCKS_PER_LEVEL`, `GRID_SIZE`, `FORMAT_VERSION` |

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
