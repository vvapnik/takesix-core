// Conventional Commits, see CONTRIBUTING.md
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['format', 'schema', 'validate', 'parse', 'grid', 'layout', 'edit', 'links', 'query', 'deps', 'release']],
  },
}
