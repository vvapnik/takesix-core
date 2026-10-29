# Contributing

Thanks for helping with takesix! This file covers how to set up the project
and how to write commits.

## Setup

Use Node 24 LTS (`.nvmrc`; with nvm run `nvm use`).

```bash
npm install
npm test
npm run build
```

Every change should keep `npm test` and `npx tsc --noEmit` passing. New
behaviour needs a test.

## Commit messages

We use [Conventional Commits](https://www.conventionalcommits.org/). The
history drives versioning and the changelog, so please follow it.

```
<type>(<scope>): <summary>

<body: why and what, optional>

<footer: BREAKING CHANGE, Refs #12, optional>
```

- English, imperative mood: "add", not "added" or "adds".
- Lower case summary, no trailing period, first line at most 72 characters.
- One logical change per commit.

### Types

| Type | Use for | Release |
|---|---|---|
| `feat` | a new capability | minor |
| `fix` | a bug fix | patch |
| `perf` | faster, same behaviour | patch |
| `refactor` | code change without behaviour change | — |
| `docs` | README, FORMAT.md, comments | — |
| `test` | tests only | — |
| `build` | build setup, dependencies, package.json | — |
| `ci` | GitHub Actions | — |
| `chore` | anything else (.gitignore, configs) | — |

### Scopes

`format`, `schema`, `validate`, `parse`, `migrate`, `edit`, `links`, `query`,
`deps`. Leave the scope out when a change touches the whole package.

### Breaking changes

Add `!` after the type and explain in a `BREAKING CHANGE:` footer. This bumps
the major version.

```
feat(edit)!: return a result object from removeBlock

BREAKING CHANGE: removeBlock now returns { document, removed } instead of the document.
```

### Changes to the format

The JSON format is a public contract. Any change to `schema/` or `FORMAT.md`
that changes which documents are valid uses the `format` scope:

- a new optional field → `feat(format): …` and a new minor format version
  (1.0 → 1.1);
- a removed field, a field that becomes required, or a field whose meaning
  changes → `feat(format)!: …` and a new major format version.

Wording fixes that do not change validity are `docs(format): …`.

### Examples

```
feat(links): project cross-level links onto visible ancestors
fix(edit): keep links when moving a block between levels
docs(format): describe link visibility rules
build(deps): bump vitest to 1.6
```

### No AI co-author trailers

Do not add `Co-Authored-By` trailers (or similar attribution lines) for AI
models or coding assistants. Commits are authored by the person who submits
them, and that person is responsible for the change. `Co-Authored-By` is for
human co-authors only.
