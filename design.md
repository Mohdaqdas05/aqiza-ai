# AqizaAI UI direction

Status: approved by the user on 2026-11-10. The first implementation now follows the three reviewed screens; the local preview is available at http://127.0.0.1:3000/ for review.

## What this design should fix

- Make sign-in and account creation easy to find without forcing an account before local Ollama can be used.
- Show the signed-in person's name in the account area and beside their chat messages.
- Keep one model picker in the composer. The chat header must not repeat it.
- Make the workspace feel like a practical developer tool: quiet, legible, and shaped around conversations and code.
- Keep development overlays and framework marks out of the product UI. The Next.js dev indicator is not AqizaAI branding.

## Reference inspection

Inspected the signed-in ChatGPT home screen at `https://chatgpt.com/` on 2026-11-10. The UI uses a narrow, persistent left navigation, a clear new-chat action, grouped conversation history, account access at the bottom, and one central composer on the empty state. The main area stays visually quiet and puts the conversation input first. These are interaction and hierarchy references only; AqizaAI should keep its own name, wording, and restrained green accent. No conversation content or history is part of this design reference.

## Product decisions

### Accounts

- Guest use remains available so a person can use a local model without signing in.
- The sidebar always has an obvious account entry: “Sign in or create account” while signed out; avatar, name, email, and sign-out action while signed in.
- Account entry opens an in-app sign-in dialog. It must not silently redirect to the home page.
- Google OAuth is the primary sign-in path. Continuing with Google signs in an existing user or creates an account for a new user. Explain that directly below the button.
- After sign-in, show the provider's display name in the sidebar and as the speaker label on that person's messages. Use the provider image when available and initials otherwise.
- If OAuth credentials are missing in a development environment, show a clear setup message instead of a disabled mystery icon. Never imply sign-in is working until a provider is configured.

### Chat workspace

- Keep the sidebar for AqizaAI branding, new chat, search, recent conversations, settings, and the account entry.
- The header contains the current conversation title and relevant conversation actions only. No model selector there.
- The composer contains the message field, one selected-model control, and send/stop. The selected model stays visible while chatting.
- A local Ollama model is labelled as local. Large-model warm-up gets a plain status message with the model name and an honest wait estimate; it must not look like a frozen animation.
- Empty state uses a short, conversational prompt and at most a few small text suggestions. Do not use a large marketing hero, a grid of feature cards, or generic “AI magic” language.
- Conversation rows show the actual speaker names: the signed-in user's name, “You” for guests, and “AqizaAI” for the assistant.

## Visual direction

- Primary appearance: neutral charcoal, close to the inspected reference, with clear gray-on-gray surface steps.
- Keep one subdued green accent for focus, the selected model, and successful local connection. Do not add gradients, neon colors, or unrelated accent colors.
- Light appearance is a simple neutral counterpart, not a second color identity.
- Use IBM Plex Sans for interface text and JetBrains Mono only for code and technical identifiers, matching the current product source.
- Use compact, consistent spacing; thin dividers; modest corner radii; minimal shadows; and visible focus states.
- Use simple functional icons. Do not use sparkles as the product mark, an unrelated “N” avatar, or imported Notion branding.
- Keep text sentence-case and specific to the action. Prefer “Sign in or create account”, “New chat”, and “Choose a model”.

## Figma review frames

1. **Workspace — guest**: recent chats, obvious account entry, clean empty state, single Ollama selector in the composer.
2. **Workspace — signed in**: provider avatar/initial, account name, email, sign-out action, and the user's display name on a chat message.
3. **Sign in / create account**: in-app dialog, Google action, clear OAuth account-creation note, and a guest continuation action.

Use the existing Simple Design System components where they fit, then use local semantic tokens for AqizaAI's colors, spacing, and type. All Figma frames should use editable text, vectors, and components rather than a flattened screenshot.

The reviewed visual pass is available in the Figma review file and as [design-preview.svg](design-preview.svg). The user approved this layout, copy, account flow, and single model-picker placement on 2026-11-10. Match the approved board in code; only fix implementation issues such as responsive clipping or inaccurate account/model status.

## Acceptance checks

- A signed-out user can see where to sign in or create an account, and can still continue locally.
- A new Google user and an existing Google user follow the same clearly explained OAuth action.
- A signed-in user's actual display name is visible in the profile area and chat transcript.
- There is only one model selector in the main chat view.
- The same hierarchy works at desktop and narrow/mobile widths.
- The screen contains no framework dev-tools badge, Notion mark, decorative AI gradients, or unexplained disabled controls.
- The user approved the guest workspace, signed-in conversation, and sign-in dialog for implementation on 2026-11-10.

## Setup dependency

The current workspace reports no configured OAuth providers. Functional Google sign-in requires `AUTH_GOOGLE_ID` and `AUTH_GOOGLE_SECRET` in the local environment (and the matching OAuth callback URL registered with Google). The UI must state this plainly in local development until those credentials are supplied.

## Current Figma access state

The review file is available at `https://www.figma.com/design/Po3Fsly1aAJOP3SUZGyHUz/AqizaAI-%E2%80%94-Product-UI-review`. The connected Figma MCP has reached its Starter-plan call limit; the visual board was placed through the Figma editor UI and verified in the file. The user approved the current screens, so keep [design-preview.svg](design-preview.svg) as the implementation reference and do not redesign the board.

