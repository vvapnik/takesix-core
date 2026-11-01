// Conventional Commits, see CONTRIBUTING.md
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [2, 'always', ['format', 'schema', 'validate', 'parse', 'migrate', 'edit', 'links', 'query', 'deps', 'release']],
  },
}
