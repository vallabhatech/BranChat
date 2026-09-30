# BranChat

**Branching conversations with privacy-first, on-device AI.**

BranChat is a full-stack chat application built around one simple idea: a conversation should not have to stay linear. Users can branch from a message into focused sub-chats, explore alternatives, then merge the useful context back into the main conversation.

## Why BranChat

- 🌿 **Branch conversations** without losing the original thread.
- 🧠 **Chrome Built-in AI** for supported on-device workflows.
- 🔁 **Server-side Gemini fallback** when local AI is unavailable.
- 🔐 **JWT authentication, rate limiting, security headers and validation**.
- 💾 **MongoDB persistence** for users, conversations, messages and branches.
- ⚡ **Streaming responses** for a responsive chat experience.
- 🧩 **Provider abstraction** so AI integrations can evolve independently.
- 🧠 **Optional semantic memory** through Elasticsearch.
- 📊 **Health and observability endpoints** for deployment environments.

## Architecture

```text
┌───────────────────────────────┐
│ React + TypeScript + Vite     │
│                               │
│ Chrome Built-in AI            │
│ Chat / Branches / Memory      │
└───────────────┬───────────────┘
                │ REST / streaming
                ▼
┌───────────────────────────────┐
│ Node.js + Express + TypeScript│
│ Auth / Conversations / AI     │
│ Rate limits / Validation      │
└───────┬───────────────┬───────┘
        │               │
        ▼               ▼
    MongoDB        Gemini fallback
        │
        ▼
 Optional Elasticsearch
       memory
```

## Repository layout

```text
BranChat/
├── backend/                 # Express + TypeScript API
│   ├── src/controllers/     # HTTP request handlers
│   ├── src/middleware/      # Auth, security, validation, limits
│   ├── src/models/          # MongoDB/Mongoose models
│   ├── src/providers/       # AI provider implementations
│   ├── src/routes/          # API routes
│   └── src/config/          # Runtime configuration
├── frontend/                # React + TypeScript + Vite
│   └── src/
│       ├── components/      # Chat and UI components
│       ├── contexts/        # Application state
│       ├── hooks/           # Reusable React hooks
│       ├── providers/       # AI provider implementations
│       └── lib/             # API, storage and browser AI helpers
├── .github/
│   ├── workflows/           # CI and repository automation
│   └── scripts/             # Issue automation
└── CHANGELOG.md
```

## Requirements

- Node.js **20 LTS** recommended
- npm
- MongoDB
- Google Chrome for Chrome Built-in AI features
- Gemini API key when server-side fallback is enabled
- Elasticsearch only when semantic memory is enabled

## Local development

### 1. Clone

```bash
git clone https://github.com/vallabhatech/BranChat.git
cd BranChat
```

### 2. Configure the backend

```bash
cd backend
npm install
copy .env.example .env
```

Set at least:

```env
MONGODB_URI=mongodb://localhost:27017/branchat
JWT_SECRET=replace-with-a-long-random-secret
```

Add `GEMINI_API_KEY` if you want the server fallback.

### 3. Configure the frontend

```bash
cd ..\frontend
npm install
copy .env.example .env
```

Set `VITE_API_URL` to the backend API URL used by your environment.

### 4. Run

Backend:

```bash
cd backend
npm run dev
```

Frontend, in a second terminal:

```bash
cd frontend
npm run dev
```

Typical development URLs:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health: `http://localhost:3001/health`

## Engineering checks

Backend:

```bash
cd backend
npm run typecheck
npm run build
npm run check
```

Frontend:

```bash
cd frontend
npm run lint
npm run typecheck
npm run build
npm run check
```

CI runs these checks on pushes and pull requests. CodeQL is also enabled for JavaScript/TypeScript, and high-severity npm audit findings fail the backend CI job.

## Configuration

Environment templates are provided at:

- `backend/.env.example`
- `backend/.env.production.example`
- `frontend/.env.example`

Never commit real API keys, database credentials, JWT secrets, or production environment files.

## API surface

The backend exposes route groups for:

- `/api/auth` — authentication and sessions
- `/api/conversations` — conversation lifecycle
- `/api/subchats` — branching and merge workflows
- `/api/memory` — semantic memory features
- `/api/admin` — administrative operations
- `/api/ai` — AI provider operations

Health endpoints include:

- `GET /health`
- `GET /health/ready`
- `GET /health/live`
- `GET /health/detailed`

## AI provider model

BranChat keeps AI integrations behind provider abstractions.

1. Prefer supported Chrome Built-in AI capabilities for local processing.
2. Fall back to the configured server-side provider when required.
3. Keep provider-specific code isolated so another provider can be introduced without rewriting the chat domain.

Availability of browser AI features depends on the user's browser, version, flags, device capabilities and rollout status.

## Security baseline

The backend currently includes:

- Helmet security headers
- CORS controls
- API rate limiting
- Request validation
- JWT authentication
- Structured logging
- Environment validation
- Health/readiness checks

This is an engineering baseline, not a security certification. Production deployments should still use secret management, HTTPS, least-privilege database credentials, monitoring and regular dependency updates.

## Contributing

1. Create a focused branch.
2. Make a small, reviewable change.
3. Run the relevant `check` command locally.
4. Update documentation when behavior or configuration changes.
5. Open a pull request with a clear description and testing notes.

See the repository's existing issue templates and automation under `.github/`.

## License

MIT — see [LICENSE](LICENSE).

## Project status

BranChat is an actively evolving project. The modernization work is intentionally incremental: strengthen the delivery pipeline and maintainability first, then improve individual product areas without unnecessarily changing working behavior.

See [CHANGELOG.md](CHANGELOG.md) for the maintenance history.
