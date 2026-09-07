# AI Concept Lab · POC #001

## AI Video Receptionist

A compact talking-avatar starter: meet Nova, ask about a sample business, and leave a project enquiry. The UI is the product: a video stage, streaming conversation, suggested questions, FAQ drawer, and contact form.

**Works immediately without credentials.** Preview mode is deliberately labeled: exact local FAQ matching, no AI inference, no video, no microphone, and no vendor calls. Add your D-ID agent and domain-restricted client key to enable real avatar conversations.

### Quick start

Requires Node.js 22.13+ and npm. Use a recent desktop browser.

1. Extract this project and open a terminal in its folder.
2. Install packages and create the local database:

```sh
npm ci
npm run db:init
```

3. Copy `.env.example` to `.env` (or leave it absent for preview mode):

```powershell
Copy-Item .env.example .env
```

On macOS/Linux use `cp .env.example .env`.

4. Start the app:

```sh
npm run dev
```

Open the Local URL printed in the terminal (normally http://localhost:3000). Try a suggested question, ask something absent from the FAQ, then submit an enquiry using `alex@example.com`.

Read saved enquiries in your terminal:

```sh
npm run db:list
```

No Cloudflare login, database account, OpenAI key, or D-ID account is needed for this local preview. SQLite storage is provided by the local Cloudflare D1 emulator under `.wrangler/state/v3/d1`. Stopping the app preserves records. There is intentionally no public lead-list endpoint.

### Bring Nova to life

Full walkthrough: [BUILD.md](BUILD.md).

1. Create a new agent in [D-ID Studio](https://studio.d-id.com/), choosing an avatar and voice available to your account.
2. Add [knowledge/faq.txt](knowledge/faq.txt) to its knowledge and wait until processing completes. Copy [knowledge/agent-instructions.txt](knowledge/agent-instructions.txt) into its instructions. Save the agent.
3. In the agent’s **Embed** settings, allow your exact local origin (normally `http://localhost:3000`). Copy the agent ID and **client key** into `.env`.
4. Set `DID_AVATAR_TYPE=expressive` only for a V4 Expressive agent if you want microphone input. Classic photo/video avatars work with typed questions and spoken video replies.
5. Restart the development server. The badge changes to **Live avatar mode**. Click **Start conversation**.
6. Optionally enable conversational lead capture with `npm run agent:tool`, as explained below. The visible enquiry button works even without the tool.

The static “N” is an intentional preview monogram. Once connected, the avatar’s own thumbnail, idle video, and live media replace it. This project does not include a fake prerecorded talking person.

### Agent-triggered enquiry form

The action is `open_contact_form`. It opens the same form used by the enquiry button and can prefill a project topic. It does not silently save contact information.

Set `DID_API_KEY` in `.env` to the private API credential from your D-ID account, using the exact value after `Basic ` in the vendor’s API example. Then:

```sh
npm run agent:tool
```

This local script creates a client tool and attaches it to your configured agent. It preserves other tools and normally reuses an existing tool with this name. A local ID cache helps recover if tool creation succeeds but attachment fails. Restart the conversation after attaching it. No private API key is required by the running web app.

Ask “Can I discuss a project?” The agent should open the form and ask you to review it. The visitor enters contact details, checks consent, and submits. The backend stores the record, and only then does the UI show a receipt. Neither the tool nor this starter sends email, schedules meetings, or contacts a real team.

### Stack and files

React + TypeScript on the supplied Sites/Vinext starter, Vite, D-ID Client SDK **2.0.7**, and a small D1-backed API. The framework is a pinned beta starter; the lockfile is included for reproducibility. The project remains local and has no registered hosting project.

| File                               | Purpose                                                                 |
| ---------------------------------- | ----------------------------------------------------------------------- |
| `components/receptionist.tsx`      | Interface, SDK lifecycle, transcript, microphone, lead form             |
| `app/api/config/route.ts`          | Exposes only the domain-scoped public client configuration              |
| `app/api/leads/route.ts`           | Prepared database insert; repeated receipt IDs do not create duplicates |
| `lib/leads.mjs`                    | Request and consent validation; bounded request-body reading            |
| `lib/preview.mjs`                  | No-key deterministic FAQ matching and unknown-answer fallback           |
| `knowledge/faq.json`               | Single source for the local sample FAQ                                  |
| `knowledge/faq.txt`                | Generated upload for the hosted agent                                   |
| `knowledge/agent-instructions.txt` | Grounding and action instructions                                       |
| `knowledge/open-contact-tool.json` | Vendor client-tool definition                                           |
| `scripts/setup-tool.mjs`           | Optional account-side tool registration                                 |
| `migrations/0001_leads.sql`        | Local lead-storage schema                                               |
| `tests/core.test.mjs`              | Grounding fallback and lead API contract tests                          |

### Commands

| Command                   | Result                                                                     |
| ------------------------- | -------------------------------------------------------------------------- |
| `npm run dev`             | Local development server                                                   |
| `npm run db:init`         | Apply local database migrations                                            |
| `npm run db:list`         | Read the 50 newest local enquiries                                         |
| `npm run knowledge:build` | Regenerate the TXT upload after editing the JSON                           |
| `npm run agent:tool`      | Create/attach the D-ID client action; requires your private API credential |
| `npm run typecheck`       | Type-check app and installed SDK calls                                     |
| `npm test`                | Seven contract tests                                                       |
| `npm run lint`            | Source lint checks                                                         |
| `npm run build`           | Compile a production Worker bundle                                         |
| `npm start`               | Serve the production bundle locally; run build first                       |

`npm start` normally uses port 8787. Add that origin in D-ID if you use live mode there. Public client settings are included in the generated Worker configuration; rebuild after changing them. The private `DID_API_KEY` is explicitly excluded.

### What “grounded” means here

Preview returns exact supplied facts and links to their local FAQ section. Unknown questions receive a fallback. This small keyword matcher is not an LLM and is not a semantic search benchmark.

Live mode uses the knowledge uploaded to your D-ID agent and the supplied refusal instructions. Generative answers can still be wrong; these instructions are not a hard factuality guarantee. The app does not fabricate live citations. Editing the local JSON does **not** update your hosted agent automatically: regenerate the TXT, replace the hosted document, wait for indexing, and start a fresh session.

All sample business claims are fictional. Replace them before adapting the receptionist to a real organization.

### Cost and privacy

The no-key preview runs locally without usage charges. Live D-ID usage depends on account access, plan, avatar, and available credits; a trial is not an unlimited free service. See [official API pricing](https://www.d-id.com/pricing/api/). This starter does not subscribe to a plan or create a paid session until you configure an account and start a conversation.

The app stops sessions after three minutes and provides an End button. These are convenience controls, not a vendor-side spending cap; set account limits where available. The avatar SDK loads only when a live conversation starts. Microphone access is opt-in for Expressive avatars; camera access is never requested.

Preview questions stay in browser memory. Live messages/audio travel to D-ID and its configured providers. The app does not save transcripts. D-ID may retain session data according to its own settings and policies. Enquiry data is stored locally by this app. Do not paste secrets into chat or commit `.env`, `.local`, or `.wrangler`.

### POC boundaries

This is an easy local starter, not a production lead-processing service. Validation, consent, same-origin checks, body limits, a honeypot, and duplicate-submit protection are included. Rate limiting, bot challenges, operator authentication, retention/deletion workflows, monitoring, and CRM/email integrations are not. Add those and update the privacy copy before exposing the app publicly. The zero database ID is an emulator placeholder, not a deployable cloud database.

The D-ID management script handles the normal setup path. Do not edit the same agent concurrently while attaching tools. If a creation request times out with an ambiguous result, inspect the tools in your account before rerunning, since any remote create can have succeeded before the network failed.

### Verification

The starter was checked on 2026-09-06:

- Production build, TypeScript, and application lint checks passed. Unmodified scaffold UI components and the scaffold mobile hook are excluded from lint.
- Seven automated tests passed.
- Development and compiled production pages/config endpoints returned HTTP 200. Lead submission worked in both modes, sharing the same local database.
- A real local API submission persisted in SQLite; retrying its ID produced one row.
- Authenticated D-ID video, audio, knowledge retrieval, and remote tool execution were **not** exercised because no vendor credentials were supplied.
- No browser interaction or visual automation was run; use the acceptance steps in BUILD.md for the connected session.

Official integration references and known SDK differences are documented in [BUILD.md](BUILD.md).

