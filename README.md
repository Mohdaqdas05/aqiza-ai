# AqizaAI

AqizaAI is a developer-focused AI chat workspace built with Next.js, TypeScript, Auth.js, Prisma, and the Vercel AI SDK. Use a hosted model provider, or run Ollama on your own computer and chat with models you have already downloaded. Local Ollama use does not require an AqizaAI API key.

## What is included

- Streaming chats with Google Gemini, Groq, OpenRouter, and local Ollama models
- Automatic discovery of downloaded Ollama chat models, with a one-click connect/refresh action
- Google and GitHub sign-in when credentials are configured; guest conversations during local development
- Conversation history, search, older-message pagination, retry, Markdown/code rendering, and Markdown export
- Per-conversation model and instructions, plus saved account defaults for signed-in users
- SQLite for local development; durable libSQL-compatible storage and Upstash rate limiting for production

## Requirements

- Node.js 20.9 or newer and npm
- Git, if you are cloning the repository
- For a hosted model: an API key from a supported provider
- For free local inference: [Ollama](https://ollama.com/download) and at least one model downloaded on the same computer as AqizaAI

You only need one model provider to chat. Ollama runs locally and needs no provider key. Hosted provider keys are optional and are read by server code only.

## Install and run locally

Clone the repository and install its locked dependencies:

```bash
git clone https://github.com/Mohdaqdas05/aqiza-ai.git
cd aqiza-ai
npm ci
```

Create the local environment file and apply the checked-in database migrations:

```powershell
# Windows PowerShell
Copy-Item .env.example .env
npm run db:deploy
```

On macOS or Linux, use `cp .env.example .env` in place of `Copy-Item`.

Open `.env`. Its local SQLite URL is already set. For chat, either configure one hosted provider key (see below) or install Ollama and download a model. Then start the app:

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Use downloaded Ollama models

1. Install Ollama from [ollama.com/download](https://ollama.com/download) and launch it once.
2. Download a model from the Ollama library, or use the Ollama command line. For example:

   ```bash
   ollama pull qwen2.5-coder:7b
   ```

3. Run AqizaAI on the same computer. In the model menu or setup prompt, choose **Connect Ollama** or **Start & connect**.
4. AqizaAI checks the local Ollama installation, starts/checks its service, and lists downloaded models that support chat. Choose one from the model menu. Use **Refresh models** after downloading another model.

Ollama model files can be large; choose a model size that fits your computer's memory. AqizaAI discovers models that are already on the machine. It does not silently download models for you. No Ollama API key is needed; `OLLAMA_API_KEY` defaults to a local placeholder.

The default local address is `http://127.0.0.1:11434`. Leave `OLLAMA_BASE_URL` blank for automatic local detection. Set it only when the AqizaAI server can safely reach a separate Ollama server. A browser visitor's local Ollama service cannot be reached by a Vercel-hosted AqizaAI server.

### Configure hosted model providers

Add one or more keys to `.env`, then restart `npm run dev`. AqizaAI shows models whose provider is configured.

| Provider | Environment variable | Models in AqizaAI |
| --- | --- | --- |
| Google Gemini | `GOOGLE_GENERATIVE_AI_API_KEY` | Gemini 2.5 Flash, Gemini 2.5 Pro |
| Groq | `GROQ_API_KEY` | GPT-OSS 120B, GPT-OSS 20B |
| OpenRouter | `OPENROUTER_API_KEY` | OpenRouter free-model router |
| Ollama | No provider key | Chat-capable models downloaded locally |

Provider prices, free tiers, rate limits, and model availability are controlled by each provider and can change. OpenRouter's free router uses its current eligible model catalog.

## Google and GitHub sign-in

Sign-in is optional for local development. To enable Google sign-in, create a Web application OAuth client in Google Cloud and add this exact redirect URI:

```text
http://localhost:3000/api/auth/callback/google
```

Set the matching client ID and secret in `.env` as `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET`. For production, register `https://your-domain/api/auth/callback/google` with the provider and use the production domain in Auth.js settings.

For GitHub sign-in, create an OAuth App and use the callback `http://localhost:3000/api/auth/callback/github` locally, or `https://your-domain/api/auth/callback/github` in production. Set `AUTH_GITHUB_ID` and `AUTH_GITHUB_SECRET`.

Set `AUTH_SECRET` to a unique random value. Generate one with Node.js:

```bash
node -e "console.log(require('node:crypto').randomBytes(32).toString('base64'))"
```

Auth.js only enables a provider when both its ID and secret are present. OAuth redirect URLs must exactly match the value registered with Google or GitHub. Accounts from different providers are not automatically merged based only on matching email addresses.

## Environment variables

The checked-in `.env.example` is the source of truth for names and local defaults. Never commit `.env` or put server keys in browser-exposed variables.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Local default is `file:./prisma/dev.db`; production must use a durable remote database URL. |
| `DATABASE_AUTH_TOKEN` | Optional authentication token for managed libSQL databases. |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Optional Gemini chat access. |
| `GROQ_API_KEY` | Optional Groq chat access. |
| `OPENROUTER_API_KEY` | Optional OpenRouter chat access. |
| `AUTH_SECRET` | Auth.js signing/encryption secret; set for OAuth and production. |
| `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET` | Optional Google OAuth credentials. |
| `AUTH_GITHUB_ID`, `AUTH_GITHUB_SECRET` | Optional GitHub OAuth credentials. |
| `OLLAMA_BASE_URL` | Optional Ollama server URL; blank enables local auto-detection. |
| `OLLAMA_API_KEY` | Optional compatibility value for Ollama; defaults to `ollama`, not a paid key. |
| `ALLOW_GUEST_CHAT` | Explicitly enables guest chat in production when set to `true`; local development can use guest chat. |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | Both required for production chat rate limiting. |

## Data and privacy

Local conversations are stored in `prisma/dev.db`. In production, use a durable managed libSQL database; Vercel rejects a local `file:` database because serverless disk is temporary. Guest conversation ownership uses a random browser cookie; after sign-in in that browser, eligible guest conversations can be claimed by the account. Signed-in conversations are scoped to the account. The API validates same-origin writes and limits chat requests per owner.

Development uses an in-process rate limiter. Production uses Upstash Redis and fails closed if the Redis settings are missing or unavailable. Do not expose provider secrets using `NEXT_PUBLIC_` variables.

## Deploy to Vercel

Before serving a production deployment:

1. Create a durable libSQL database and configure `DATABASE_URL`; add `DATABASE_AUTH_TOKEN` if the database requires it.
2. Create an Upstash Redis database and set both `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN`.
3. Set `AUTH_SECRET` and at least one Google or GitHub OAuth ID/secret pair. Register the production callback URL with that provider.
4. Add any hosted AI provider keys you plan to offer. Keep all credentials in server-side Vercel environment variables.
5. Apply the committed Prisma migrations against the production database by running `npm run db:deploy` with that database's environment variables configured.
6. Deploy the project with Vercel's standard Next.js build settings.

Vercel builds fail early when `DATABASE_URL` is absent or points to a local `file:` database. Chat requests return unavailable when production rate limiting is not configured. Local Ollama is for an AqizaAI server running on the same computer/network as Ollama; a public Vercel instance cannot reach a visitor's `127.0.0.1`.

## Useful commands

```bash
npm run dev          # Start the local app
npm run lint         # Check source formatting and common mistakes
npm test             # Run the project test suite
npm run build        # Generate Prisma Client and create a production build
npm run db:deploy    # Apply committed migrations
npm run db:migrate   # Create and apply a local development migration
npm run db:studio    # Open Prisma Studio for the configured database
```

## Troubleshooting

- **No Ollama models appear:** make sure Ollama is installed and running, download a chat model, then choose **Connect Ollama** or **Refresh models**. Embedding-only models are filtered out.
- **Ollama is installed but will not connect:** run AqizaAI on the same computer as Ollama, open the Ollama app once, and check that its local service is available at `http://127.0.0.1:11434`.
- **A hosted model is unavailable:** confirm the matching provider key is present in `.env`, restart the dev server, and check the provider account's model access and usage limits.
- **OAuth reports a redirect error:** compare the callback URL in the provider console with the local or production URL above; scheme, hostname, port, and path must match.
- **Production build rejects the database:** configure a durable remote `DATABASE_URL`; do not use `file:` on Vercel.
- **Production chat returns unavailable:** check both Upstash REST variables and confirm that Redis is reachable.
