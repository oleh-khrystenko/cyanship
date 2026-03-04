# Env Sync Convention

When adding, renaming, or removing environment variables, **always update all three files** in a single change:

1. **`apps/api/src/config/env.ts`** (or `apps/web/src/shared/config/env.ts`) — runtime config with `getEnvVar()`
2. **`.env.example`** — documentation for new developers (placeholder values)
3. **`.env`** — local development values (real test keys or `price_xxx` placeholders)

Skipping any of these files leads to broken local setups or missing documentation.
