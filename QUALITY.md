# Code Quality Assessment

This document provides an overview of the production quality measures implemented in this codebase.

## Linting and Code Quality

### Tooling

- **Linter**: [Biome](https://biomejs.dev/) via the [Ultracite](https://github.com/haydenbleasel/ultracite) preset
- **TypeScript**: Strict mode enabled (`strict: true`, `strictNullChecks: true`)
- **Editor**: VSCode configured for Biome format-on-save

### Automated Checks

| Check | Trigger | Command |
|-------|---------|---------|
| Lint (staged files) | Pre-commit hook | `biome check` on staged files |
| Build | Pre-push hook (main branch) | `pnpm build:check` |
| CI Lint | Every push | GitHub Actions |

### Configuration Files

- `biome.jsonc` - Biome/Ultracite configuration
- `tsconfig.json` - TypeScript strict settings
- `.husky/pre-commit` - Pre-commit lint hook
- `.husky/pre-push` - Pre-push build check
- `.github/workflows/lint.yml` - CI lint workflow

## Error Handling

### ChatSDKError

All API errors use a structured `ChatSDKError` class (`lib/errors.ts`) with:

- **Typed error codes**: `ErrorType:Surface` format (e.g., `bad_request:chat`, `rate_limit:chat`)
- **Visibility controls**: Errors can be shown to users or logged server-side only
- **Consistent responses**: `toResponse()` method returns proper HTTP status codes

### Error Types

| Type | HTTP Status | Description |
|------|-------------|-------------|
| `bad_request` | 400 | Invalid input or request |
| `unauthorized` | 401 | Authentication required |
| `forbidden` | 403 | Access denied |
| `not_found` | 404 | Resource not found |
| `rate_limit` | 429 | Rate limit exceeded |
| `offline` | 503 | Service unavailable |

### Surfaces

Errors are categorized by surface area: `chat`, `auth`, `api`, `document`, `contact`, `database`, etc.

### React Error Boundary

The app includes an `ErrorBoundary` component (`components/error-boundary.tsx`) that catches React rendering errors and displays a user-friendly fallback UI.

## Rate Limiting

### Chat API Limits

| User Type | Limit |
|-----------|-------|
| Pilot users | 500 total messages |
| Regular users | 1000 messages/day |

Limits are enforced in the chat API route and return `rate_limit:chat` when exceeded.

### Configuration

Rate limits are defined in `lib/ai/entitlements.ts` via `maxMessagesPerDay` per user type.

## Retry Logic

Exponential backoff is implemented for external API calls:

| Service | Max Retries | Backoff Formula | Triggers |
|---------|-------------|-----------------|----------|
| Embeddings (Turbopuffer) | 2 | 250ms × 3^retry | 5xx responses |
| SharePoint sync | 3 | 1s × 2^attempt (max 10s) | Transient errors |
| Translation (OpenAI) | 6 | 0.5s → 8s | Rate limits, timeouts |

## Code Organization

### Directory Structure

```
├── app/                  # Next.js App Router (routes, API)
│   ├── (auth)/          # Authentication pages
│   ├── (chat)/          # Main app and chat API
│   └── api/             # Public API routes
├── components/          # React components
│   ├── ui/              # shadcn primitives
│   ├── elements/        # Domain components
│   └── integrations/    # Third-party integrations
├── lib/                 # Shared logic
│   ├── ai/              # AI agents, tools, prompts
│   ├── db/              # Database schema and queries
│   ├── rag/             # RAG and vector search
│   ├── ingest/          # Document ingestion
│   └── integrations/    # Google, Microsoft APIs
├── hooks/               # Custom React hooks
└── artifacts/           # Document type handlers
```

### Key Patterns

- **Typed errors**: `ChatSDKError` for consistent API responses
- **Server-only imports**: Database queries use `import "server-only"`
- **Factory pattern**: Artifact handlers use `createDocumentHandler`
- **Custom hooks**: Reusable state management (11 hooks)

## Testing

Run tests with:

```bash
pnpm test        # Run tests
pnpm lint        # Run linter
pnpm build:check # Type check and build
```

## Continuous Integration

GitHub Actions runs on every push:

1. Install dependencies
2. Run `pnpm lint` (Biome/Ultracite)
3. Report any failures

See `.github/workflows/lint.yml` for the full workflow.
