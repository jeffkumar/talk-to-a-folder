# Local Database Setup

Use a local PostgreSQL database when Neon has latency issues.

## Quick Toggle

In `.env.local`:

```bash
# Use local database
USE_LOCAL_DB=true

# Use Neon (default)
USE_LOCAL_DB=false
```

## Commands

```bash
# Start local Postgres
brew services start postgresql@14

# Stop local Postgres
brew services stop postgresql@14

# Check if Postgres is running
pg_isready -h localhost

# Run migrations on local DB
pnpm run db:migrate

# Create database (first time only)
createdb flowchat
```

## Connection URL

Default local URL (can override in `.env.local`):
```
LOCAL_POSTGRES_URL=postgresql://localhost:5432/flowchat
```

## When to Use

- **Local DB**: Neon outages, faster dev iteration, offline work
- **Neon**: Production-like data, testing with real data, normal development
