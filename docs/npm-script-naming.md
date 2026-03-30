# NPM Script Naming Convention

## Why `formatfix` and `lintfix` instead of `format:fix` or `format-fix`?

The npm scripts `formatfix` and `lintfix` are named without separators due to limitations when integrating npm with Gradle.

### The Issue

When using the node-gradle plugin in a Gradle monorepo:

- **Gradle interprets `:` as subproject notation**: A script named `format:fix` would be misinterpreted by Gradle as referring to a subproject, not an npm script
- **The node-gradle plugin interprets `_` as spaces**: A script named `format_fix` would be executed as `format fix` (two separate arguments), breaking execution

### Common Alternatives and Why They're Not Used

- **Colon separator** (`format:fix`): ❌ **Does not work** - Gradle uses `:` for subproject notation (e.g., `:frontend:build`)
- **Underscore separator** (`format_fix`): ❌ **Does not work** - The node-gradle plugin converts underscores to spaces

### Solution

Use **camelCase** without any separators:
- ✅ `formatfix` - Prettier autofix
- ✅ `lintfix` - ESLint autofix

This approach:
- Works correctly with the node-gradle plugin
- Maintains consistency with JavaScript naming conventions
- Keeps script names concise and readable
