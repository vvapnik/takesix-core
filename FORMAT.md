# takesix format 1.0

A takesix document describes a diagram as a tree of **blocks**. One screen
shows one level of the tree, and **a level never holds more than 6 blocks**.
Opening a block shows its children, again at most 6. **Links** connect blocks,
on the same level or across levels.

The format is plain JSON. A machine-readable definition lives in
[`schema/takesix-1.0.schema.json`](schema/takesix-1.0.schema.json). Some rules
cannot be expressed in JSON Schema (unique ids, link endpoints); those are
listed below and checked by `validateDocument()` in `@takesix/core`.

## Example

```json
{
  "$schema": "https://raw.githubusercontent.com/vvapnik/takesix-core/main/schema/takesix-1.0.schema.json",
  "takesix": "1.0",
  "title": "Online shop",
  "blocks": [
    { "id": "web", "icon": "🖥", "title": "Web app", "description": "React SPA" },
    {
      "id": "api",
      "title": "API",
      "description": "Public HTTP API",
      "children": [
        { "id": "auth", "title": "Auth", "size": "S" },
        { "id": "orders", "title": "Orders", "size": "L", "details": "Handles **checkout** and refunds." }
      ]
    },
    { "id": "db", "title": "Database" }
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
| `description` | string | | Short plain text shown on the card. |
| `details` | string | | Long Markdown text shown in the details panel. |
| `icon` | string | | An emoji or a single character. |
| `size` | Size | | Width on its level, `"M"` when absent. |
| `children` | Block[] | | At most 6. |
| `meta` | object | | Extension data. |

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

## Size

There are no layouts to choose from: a level is a flow of blocks, left to
right, wrapping to the next row. Each block sets its own width:

| Size | Width |
|---|---|
| `"S"` | a third |
| `"M"` | a half (default) |
| `"L"` | two thirds |
| `"F"` | the full width |

Three `S` blocks make a row of tiles, six `F` blocks make a list, `L` + `S`
or `M` + `M` fill a row. Blocks keep their order; a block that does not fit
the rest of a row starts the next one.

## Validation rules

Errors (the document is rejected):

- missing required field, wrong type, empty `id` or `title`;
- more than 6 blocks on one level;
- duplicate block id, duplicate link id;
- link endpoint that is not a block id;
- link from a block to itself;
- unknown `size` or `direction` value;
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

## Legacy format

The original takesix app stored a bare array of entities with per-entity
`connections` (same-level target ids). `parseDocument()` detects that shape
and converts it: entities become blocks, each connection becomes a link with
id `"<from>-><to>"`.
