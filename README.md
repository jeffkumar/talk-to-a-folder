# Talk to a Folder

A conversational AI interface that lets you chat with your documents. Upload files, connect Google Drive, and ask questions about your content using RAG (Retrieval-Augmented Generation).

Built with Next.js, AI SDK, and Turbopuffer for vector search.

## Features

- **Document Chat**: Upload PDFs, text files, and more — then ask questions about them
- **Google Drive Integration**: Connect your Google Drive and chat with files directly
- **Multiple AI Providers**: Uses Anthropic (Claude) for chat, with OpenAI/Baseten for embeddings
- **Vector Search**: Powered by Turbopuffer for fast, accurate document retrieval
- **Project Organization**: Group documents into projects for focused conversations

## Quick Start

```bash
# Install dependencies
pnpm install

# Set up your environment variables (see below)
cp .env.example .env.local

# Run database migrations
pnpm db:migrate

# Start the development server
pnpm dev
```

Your app will be running at [http://localhost:3000](http://localhost:3000).

## Environment Setup

Copy `.env.example` to `.env.local` and fill in the required values. See the sections below for how to obtain each credential.

### Required: Core Infrastructure

| Variable | Description | How to Get |
|----------|-------------|------------|
| `AUTH_SECRET` | NextAuth.js session encryption key | Run `openssl rand -base64 32` |
| `POSTGRES_URL` | PostgreSQL connection string | [Neon](https://neon.tech) or [Vercel Postgres](https://vercel.com/docs/postgres) |
| `BLOB_READ_WRITE_TOKEN` | File upload storage | [Vercel Blob](https://vercel.com/docs/blob) |

### Required: AI Providers

| Variable | Description | How to Get |
|----------|-------------|------------|
| `ANTHROPIC_API_KEY` | Primary LLM for chat (Claude) | [Anthropic Console](https://console.anthropic.com/settings/keys) |
| `OPENAI_API_KEY` | Embeddings and fallback inference | [OpenAI Platform](https://platform.openai.com/api-keys) |
| `TURBOPUFFER_API_KEY` | Vector database for document search | [Turbopuffer](https://turbopuffer.com) |

### Optional: Additional Inference Providers

| Variable | Description | How to Get |
|----------|-------------|------------|
| `BASETEN_API_KEY` | Alternative inference and embeddings | [Baseten](https://baseten.co) — Dashboard → API Keys |
| `GLM_API_KEY` | ZhipuAI GLM models | [ZhipuAI](https://open.bigmodel.cn/) |

### Optional: Google Drive Integration

To enable the Google Drive file picker and OAuth connection, you need to set up a Google Cloud project.

#### Step 1: Create a Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project (or select an existing one)
3. Note your **Project Number** (visible on the project dashboard) — this is `NEXT_PUBLIC_GOOGLE_APP_ID`

#### Step 2: Enable Required APIs

In your Google Cloud project, enable these APIs:
- Google Drive API
- Google Picker API

Go to **APIs & Services → Library** and search for each one.

#### Step 3: Create OAuth Credentials

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → OAuth client ID**
3. Choose **Web application**
4. Add authorized JavaScript origins:
   - `http://localhost:3000` (development)
   - Your production domain
5. Add authorized redirect URIs:
   - `http://localhost:3000/api/integrations/google/callback`
   - `https://yourdomain.com/api/integrations/google/callback`
6. Save and copy the **Client ID** and **Client Secret**

#### Step 4: Create an API Key (for Google Picker)

1. Go to **APIs & Services → Credentials**
2. Click **Create Credentials → API key**
3. Restrict the key:
   - **Application restrictions**: HTTP referrers
   - **Website restrictions**: Add your domains (`localhost:3000/*`, `yourdomain.com/*`)
   - **API restrictions**: Restrict to Google Picker API
4. Copy the API key

#### Step 5: Configure OAuth Consent Screen

1. Go to **APIs & Services → OAuth consent screen**
2. Choose **External** (or Internal if using Google Workspace)
3. Fill in the required fields (app name, support email, etc.)
4. Add scopes:
   - `https://www.googleapis.com/auth/drive.readonly`
   - `https://www.googleapis.com/auth/drive.file`
5. Add test users if in "Testing" mode

#### Environment Variables for Google

```bash
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/integrations/google/callback

NEXT_PUBLIC_GOOGLE_APP_ID=123456789012  # Your project number
NEXT_PUBLIC_GOOGLE_API_KEY=AIzaSy...    # Your API key for Picker
```

### Optional: Microsoft SharePoint Integration

| Variable | Description | How to Get |
|----------|-------------|------------|
| `MICROSOFT_CLIENT_ID` | Azure AD app client ID | [Azure Portal](https://portal.azure.com) → App registrations |
| `MICROSOFT_CLIENT_SECRET` | Azure AD app secret | Same app registration → Certificates & secrets |
| `MICROSOFT_REDIRECT_URI` | OAuth callback URL | `http://localhost:3000/api/integrations/microsoft/callback` |

### Optional: Email (Resend)

| Variable | Description | How to Get |
|----------|-------------|------------|
| `RESEND_API_KEY` | Transactional emails | [Resend](https://resend.com/api-keys) |

### Optional: Document Parsing

| Variable | Description | How to Get |
|----------|-------------|------------|
| `REDUCTO_API_KEY` | Advanced PDF/document parsing | [Reducto](https://reducto.ai) |

### Security

| Variable | Description | How to Get |
|----------|-------------|------------|
| `INTEGRATIONS_TOKEN_ENCRYPTION_KEY` | Encrypts stored OAuth tokens | Run `openssl rand -base64 32` |

## Embeddings Provider

This project supports multiple embeddings providers. Set `EMBEDDINGS_PROVIDER` to choose:

- `openai` — Use OpenAI embeddings (requires `OPENAI_API_KEY`)
- `baseten` — Use Baseten embeddings (requires `BASETEN_API_KEY`)
- `auto` — Use Baseten if available, otherwise OpenAI

**Important**: Don't mix embedding providers within the same Turbopuffer namespace. If you switch providers, clear and re-ingest your documents.

## Local Development

### Using Local PostgreSQL

If you prefer a local database instead of Neon/Vercel Postgres:

```bash
# Start PostgreSQL locally (e.g., via Docker or Homebrew)
# Then set these in .env.local:
USE_LOCAL_DB=true
LOCAL_POSTGRES_URL=postgresql://localhost:5432/flowchat
```

### Database Commands

```bash
pnpm db:migrate  # Run migrations
pnpm db:studio   # Open Drizzle Studio (database GUI)
```

## Deployment

### Vercel (Recommended)

1. Push your code to GitHub
2. Import the project in [Vercel](https://vercel.com)
3. Add all required environment variables in the Vercel dashboard
4. Deploy

For Google OAuth in production, update:
- `GOOGLE_REDIRECT_URI` to your production callback URL
- Authorized origins/redirects in Google Cloud Console

## Code Quality

This project follows production-quality standards including:

- **Linting**: Biome via Ultracite with strict TypeScript
- **Error Handling**: Structured `ChatSDKError` with typed error codes
- **Rate Limiting**: Per-user message limits with proper 429 responses
- **Retry Logic**: Exponential backoff for external API calls
- **Git Hooks**: Pre-commit linting, pre-push build checks
- **CI**: GitHub Actions lint on every push

See [QUALITY.md](QUALITY.md) for the full code quality assessment.

## Tech Stack

- **Framework**: [Next.js](https://nextjs.org) with App Router
- **AI**: [AI SDK](https://ai-sdk.dev) with Anthropic, OpenAI, Baseten
- **Vector DB**: [Turbopuffer](https://turbopuffer.com)
- **Database**: PostgreSQL via [Neon](https://neon.tech) or [Vercel Postgres](https://vercel.com/postgres)
- **Storage**: [Vercel Blob](https://vercel.com/blob)
- **Auth**: [Auth.js](https://authjs.dev)
- **UI**: [shadcn/ui](https://ui.shadcn.com) + [Tailwind CSS](https://tailwindcss.com)
