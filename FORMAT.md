# takesix format 1.0

A takesix document describes a diagram as a tree of **blocks**. One screen
shows one level of the tree, and **a level never holds more than 6 blocks**.
Opening a block shows its children, again at most 6, or, for a block with
text instead of children, that text. **Links** connect blocks,
on the same level or across levels.

The format is plain JSON. A machine-readable definition lives in
[`schema/takesix-1.0.schema.json`](schema/takesix-1.0.schema.json). Some rules
cannot be expressed in JSON Schema (unique ids, link endpoints, blocks that
overlap); those are
listed below and checked by `validateDocument()` in `@takesix/core`.

## Example

```json
{
  "$schema": "https://raw.githubusercontent.com/vvapnik/takesix-core/main/schema/takesix-1.0.schema.json",
  "takesix": "1.0",
  "title": "Online shop",
  "blocks": [
    { "id": "web", "at": "A1:C1", "icon": "🖥", "title": "Web app", "description": "React SPA" },
    {
      "id": "api",
      "at": "D1:F1",
      "title": "API",
      "description": "Public HTTP API",
      "children": [
        { "id": "auth", "at": "A1:B1", "title": "Auth" },
        { "id": "orders", "at": "C1:F1", "title": "Orders", "details": "Handles **checkout** and refunds." }
      ]
    },
    { "id": "db", "at": "A2:F2", "title": "Database" }
  ],
  "links": [
    { "id": "l1", "from": "web", "to": "api", "label": "REST" },
    { "id": "l2", "from": "orders", "to": "db", "label": "SQL" }
  ]
}
```

## Document

| Field | Type | Required | Meaning |
|---|---|---|---|
| `takesix` | string | yes | Format version, `"1.0"`. |
| `title` | string | yes | Non-empty. |
| `blocks` | Block[] | yes | Top level, at most 6. |
| `links` | Link[] | | All links of the document. |
| `description` | string | | |
| `meta` | object | | Extension data, see below. |
| `$schema` | string | | Schema URL for editors. |

## Block

| Field | Type | Required | Meaning |
|---|---|---|---|
| `id` | string | yes | Non-empty, unique across the whole document. |
| `title` | string | yes | Non-empty. Shown on the card. |
| `at` | string | yes | Place on the level's grid: `"B3"` or `"A1:C2"`, see [Grid](#grid). |
| `description` | string | | Short plain text shown on the card and in the header of the opened block. |
| `details` | string | | Long Markdown text the block opens into. Never together with `children`. |
| `icon` | string | | An emoji or a single character. |
| `children` | Block[] | | At most 6. Never together with `details`. |
| `meta` | object | | Extension data. |

**A block opens into blocks or into text.** A block with `children` opens
into a screen of child blocks; a block with `details` opens into a screen
that reads its text, with the block's `title` and `description` on top. A
block has one or the other (or neither), never both: text about a whole
level would compete with the blocks below it. Where such text seems needed:

- drop text that only introduces the children: the header and the cards
  already say it;
- put a one-line introduction into `description`;
- move real content into a child block of its own, named for what it says
  (e.g. "Constraints"), with the text in its `details`, or into the `details`
  of the children it is about;
- when the children are small, remove them and fold what they say into the
  block's `details`.

`details` is a small Markdown subset: headings, paragraphs, `-` and `1.`
lists, `code`, **bold**, *italic*, fenced code and `https` links.

**Ids are permanent.** Links, comments and collaborative editing refer to
blocks by id, so tools must never rename or reuse an id. Any non-empty string
works; short readable slugs (`"orders-db"`) are easiest to hand-edit.

## Link

| Field | Type | Required | Meaning |
|---|---|---|---|
| `from` | string | yes | Id of a block. |
| `to` | string | yes | Id of another block. |
| `id` | string | | Unique among links. Editors always set it. |
| `label` | string | | Short text drawn on the arrow. |
| `description` | string | | Longer explanation. |
| `direction` | `"forward"` \| `"both"` \| `"none"` | | Defaults to `"forward"` (from → to). |
| `meta` | object | | Extension data. |

### How links appear on screen

Links may join blocks on any levels. On the screen of a given level, each
endpoint is replaced by its ancestor on that level:

- `orders → db` from the example appears on the top level as **api → db**,
  because `orders` lives inside `api`.
- A link is hidden on a level when both endpoints fall into the same block
  there, or when an endpoint is outside the opened block.
- Several links between the same two blocks merge into one arrow. Opposite
  one-way links merge into a two-way arrow.

A link between a block and its own ancestor or descendant is never visible on
any level. It is allowed in files (validators warn about it) but editors do
not create such links.

## Grid

Every level is laid out on its own grid of **6 columns and 6 rows**. Columns
are named `A`–`F` left to right, rows `1`–`6` top to bottom, like a
spreadsheet. Each block says which cells it covers with `at`:

- one cell: `"B3"`;
- a rectangle, top-left and bottom-right corners included: `"A1:C2"`
  (three columns wide, two rows tall).

Blocks of one level must not overlap; cells nobody covers stay empty. The grid
is the only way to place blocks: the order of the `blocks` and `children`
arrays means nothing. Text versions, screen readers and keyboard navigation
read a level row by row, left to right, by the top-left cell of each block;
editors keep the arrays in that order so files read the same way.

```
     A    B    C    D    E    F
1  [ web          ][ api          ]     web  "A1:C1"   api "D1:F1"
2  [ db                           ]     db   "A2:F2"
```

Common shapes: a list is six full-width rows (`"A1:F1"` … `"A6:F6"`), tiles
are three blocks per row (`"A1:B1"`, `"C1:D1"`, `"E1:F1"`), and a main block
with helpers is one tall block beside a column of small ones (`"A1:D3"`,
`"E1:F1"`, `"E2:F2"`, `"E3:F3"`).

Viewers keep all 6 columns at equal width, so a block's width is always
the share of the screen it asks for. Row heights follow the content. An empty
row inside the grid is a deliberate gap; empty rows at the bottom take no
space. On narrow screens viewers may shrink empty columns and rows.

Arrows are drawn straight between blocks that share a row or a column, and
from side to side between blocks that share neither (a branch of a tree), so
place linked blocks next to each other. Small blocks with empty cells between
them leave room for branching arrows and their labels. `lintLayout()` in `@takesix/core`
warns when an arrow runs through a third block or two arrows cross.

## Validation rules

Errors (the document is rejected):

- missing required field (including `at`), wrong type, empty `id` or `title`;
- `at` that is not a cell or range of the 6×6 grid, or whose second corner
  comes before the first (`"C2:A1"`);
- two blocks of one level covering the same cell;
- a block with both `children` and `details`;
- more than 6 blocks on one level;
- duplicate block id, duplicate link id;
- link endpoint that is not a block id;
- link from a block to itself;
- unknown `direction` value;
- version with a major number other than `1`.

Warnings (the document is accepted):

- unknown field (likely a typo; use `meta` for extension data);
- link that can never be visible (see above).

The JSON Schema is stricter about unknown fields than `validateDocument()`:
it rejects them, which helps catch typos when a document is generated.

## Extension data

Put tool-specific data in `meta` on the document, a block or a link. Tools
must keep `meta` they do not understand. Prefix keys with your tool name to
avoid clashes, e.g. `{ "meta": { "confluence.pageId": "123" } }`.

## Versioning

`takesix` is `"<major>.<minor>"`. A minor release only adds optional fields,
so a 1.0 reader can open a 1.x document (it will warn about the new fields).
A new major version means a breaking change; readers reject majors they do not
know.
