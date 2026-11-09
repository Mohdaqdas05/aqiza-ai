# AqizaAI Project Handoff

Updated: 2026-11-10

Keep this note current when continuing work on AqizaAI. The detailed installation and operator guide is in [README.md](README.md).

## Product direction

- Build a practical developer chat workspace that feels deliberately designed and human-finished.
- Keep the interface restrained: charcoal surfaces, readable off-white text, and green as the main accent. Avoid unrelated accent colors, gradients, generic AI-template styling, and an invented logo.
- Local models matter: users should be able to use their already-downloaded Ollama models without paying for an AqizaAI API key. Detect installed Ollama, connect/start its local service, and list its chat-capable models.
- Hosted providers are optional. Google and GitHub OAuth are wanted, but require the user's own credentials to test live.

## Current implementation

- Next.js 15, React 19, TypeScript, Vercel AI SDK, Auth.js, Prisma 7 with libSQL, SQLite locally.
- Streaming chat, Google Gemini/Groq/OpenRouter configuration, Ollama model discovery and model selection.
- Google/GitHub OAuth provider registration is conditional on complete credentials.
- Guest and account-owned conversation history, guest-to-account claiming after sign-in, server-side history search and pagination, per-conversation model/instructions, saved user defaults, Markdown/code rendering and export.
- Retry-last-message reuses the persisted user-message ID and does not duplicate the user turn; API rejects retry unless it belongs to the current owner and is the latest user message.
- Owner-scoped delete-all-chats, same-origin write checks, security headers, request validation, guest session hashing, and rate limiting (in-process for development, Upstash Redis for production).
- Migrations are checked in under `prisma/migrations`. Local defaults are documented in `.env.example` and README.
- Do not include `.env`, `prisma/dev.db`, `.next`, `node_modules`, or generated Prisma output in commits.

## Recent verification

- The latest `npm run lint`, all 22 tests, and `npm run build` passed after the Ollama launcher adjustment, using the same local database/auth environment shape configured for CI.
- The earlier Windows `EPERM` build failure was resolved by removing stale generated `.next` output after confirming no Node process was running.
- OAuth has not been live-tested because provider credentials are not available in the workspace.
- Production Vercel deployment is not configured. It needs durable libSQL, Upstash REST URL/token, Auth.js secret, production OAuth callback registrations, and any selected hosted provider keys. The deployment guide is in README.

## GitHub destination and state

- Correct repository for this Next.js app: `Mohdaqdas05/aqiza-ai`.
- `Mohdaqdas05/aqizaai` is a separate, older Express/Vite/PostgreSQL project. Do not push this Next.js app there.
- PR #1 (`codex/aqizaai-project-setup` -> `main`) was merged after its checks passed; the app, detailed README, and handoff note are now on the default branch.
- `.github/workflows/ci.yml` runs lint, the existing test suite, and the production build on pull requests to `main` and pushes to `main`. Both the PR check and the post-merge main check completed successfully (install, lint, 22 tests, and production build).
- Local folder `D:\aqiza-ai` has no `.git` metadata. Use the connected GitHub integration for follow-up pushes; do not commit environment files or generated build/dependency folders.

## Remaining work

1. When credentials are available, test Google OAuth end-to-end and configure GitHub OAuth if desired.
2. For production, provision durable database and Upstash settings, apply migrations, configure production callback URLs, and deploy.
3. Continue the product roadmap from the original brief; keep the visual direction above in every UI change.

