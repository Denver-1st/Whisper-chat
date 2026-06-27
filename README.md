# Whisper Chat

**End-to-end encrypted, Nostr-native instant messaging.**

Whisper Chat is a WhatsApp-style messaging client built on the [Whisper Relay protocol](https://github.com/Denver-1st/mprotocol) — a Nostr-native protocol family for building instant messaging clients on Nostr. Your Nostr identity is your messaging identity. All message content is end-to-end encrypted via NIP-44 and gift-wrapped via NIP-59. No phone numbers, no central servers, no tracking.

---

## Table of Contents

- [Features](#features)
- [How It Works](#how-it-works)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Configuration](#configuration)
- [Deployment](#deployment)
  - [Deploy with Shakespeare](#deploy-with-shakespeare)
  - [Deploy to Netlify](#deploy-to-netlify)
  - [Deploy to Vercel](#deploy-to-vercel)
  - [Deploy to Cloudflare Pages](#deploy-to-cloudflare-pages)
  - [Deploy to nsite](#deploy-to-nsite)
- [Protocol Documentation](#protocol-documentation)
- [Security Model](#security-model)
- [Contributing](#contributing)
- [License](#license)

---

## Features

### Messaging Core (WIP-00)
- **NIP-17 direct messages** — all messages are end-to-end encrypted with NIP-44 and gift-wrapped via NIP-59
- **Relay discovery** — messages are published to the recipient's NIP-17 DM relay list (kind 10050)
- **Rumor-based messages** — messages are unsigned rumors with canonical IDs, enabling receipts and edits
- **Self-sync** — messages are gift-wrapped to yourself, so they sync across your devices

### Read & Delivery Receipts (WIP-01 & WIP-02)
- **Blue checkmarks** — read receipts (kind 1271) confirm the recipient has seen your message
- **Grey checkmarks** — delivery receipts (kind 7753) confirm the message reached the recipient's device
- **Batch receipts** — multiple messages can be receipted in a single event to reduce relay traffic
- **Privacy-respecting** — receipts are gift-wrapped rumors; relays cannot see who is reading what

### Typing Indicators (WIP-03)
- **Real-time typing** — ephemeral gift wraps (kind 21059) signal typing activity
- **Not stored** — ephemeral wraps are only delivered to connected clients, never stored by relays
- **Auto-debounce** — indicators are sent every 4 seconds while typing and cleared on send

### Presence (WIP-04)
- **Online / offline / away** — publish your availability status (kind 14569)
- **Last-seen** — contacts can see when you were last active
- **Custom availability** — set a custom status message ("In a meeting", "Busy", etc.)
- **Auto-expiration** — online presence expires after 5 minutes and falls back to offline

### Private Groups (WIP-05)
- **Group creation** — create groups with a name, description, and profile picture
- **Member management** — admins can add and remove members
- **Group metadata** — all group metadata is gift-wrapped to members; relays can't see group names or membership
- **Stable group IDs** — groups use a UUID that persists across member changes

### Conversation Settings (WIP-06)
- **Mute** — silence notifications per-conversation, with optional expiry
- **Pin** — pin important conversations to the top of the list
- **Archive** — hide conversations from the main list without deleting them
- **Wallpaper** — custom wallpaper per conversation

### Privacy Preferences (WIP-07)
- **Granular controls** — choose who can see your last-seen, read receipts, typing indicators, and profile photo
- **Three levels** — everyone, contacts only, or nobody
- **Group invite control** — restrict who can add you to groups
- **Hide presence** — completely disable publishing online/offline status

### Contacts List (WIP-08)
- **Messaging-native address book** — separate from NIP-02 social follows
- **Petnames** — assign custom display names to contacts
- **Private contacts** — encrypt sensitive contacts with NIP-44 (NIP-51 pattern)
- **Cross-device sync** — contacts list syncs via Nostr relays

---

## How It Works

Whisper Chat is a **fully client-side application**. There is no backend server, no database, and no central authority.

```
┌─────────────────────────────────────────────────┐
│                   Whisper Chat                   │
│              (browser, client-side)              │
│                                                  │
│  ┌─────────────┐    ┌──────────────────────┐   │
│  │   React UI   │◄──►│  Whisper Relay Hooks  │   │
│  │  (WhatsApp-  │    │  (send/receive/       │   │
│  │   style)     │    │   receipts/typing)    │   │
│  └─────────────┘    └──────────┬───────────┘   │
│                                │                 │
│                   ┌────────────▼────────────┐   │
│                   │   NIP-59 Gift Wrap      │   │
│                   │   (seal + wrap via      │   │
│                   │    NIP-44 encryption)   │   │
│                   └────────────┬────────────┘   │
│                                │                 │
│         ┌──────────────────────▼──────────┐     │
│         │        Nostr Relay Pool          │     │
│         │   (NPool / Nostrify)             │     │
│         └──────────┬───────────┬──────────┘     │
└────────────────────┼───────────┼────────────────┘
                     │           │
              ┌──────▼──┐  ┌────▼──────┐
              │ Relay 1 │  │  Relay 2  │  ...
              │ (wss://) │  │  (wss://) │
              └──────────┘  └───────────┘
```

1. **You log in** with your Nostr identity (nsec, browser extension, or NIP-46 bunker signer)
2. **Messages are created** as unsigned rumors (kind 14) with a computed canonical ID
3. **Each rumor is sealed** (NIP-59 kind 13) using NIP-44 encryption with a one-time key
4. **The seal is gift-wrapped** (NIP-59 kind 1059) to each recipient using another one-time key
5. **Gift wraps are published** to the recipient's DM relay list (kind 10050)
6. **Recipients unwrap** the gift wrap, decrypt the seal, and process the inner rumor
7. **Receipts and typing indicators** follow the same gift-wrap pipeline

Relays only see opaque, encrypted gift-wrapped events addressed to one-time pubkeys. They cannot read message content, identify who is talking to whom, or see group metadata.

---

## Tech Stack

| Technology | Version | Purpose |
|---|---|---|
| **React** | 19.x | UI framework (hooks, concurrent rendering) |
| **TailwindCSS** | 4.x | Utility-first styling |
| **Vite** | 8.x | Dev server & production bundler |
| **shadcn/ui** | — | Accessible UI components on Radix UI |
| **Nostrify** (`@nostrify/react`) | 0.52+ | Nostr protocol framework (NPool, NRelay1, signers) |
| **nostr-tools** | 2.23+ | Crypto primitives (NIP-44, event signing, NIP-19) |
| **React Router** | 7.x | Client-side routing |
| **TanStack Query** | 5.x | Data fetching, caching, state management |
| **TypeScript** | 6.x | Type-safe JavaScript (no `any` allowed) |
| **Lucide React** | — | Icon library |

---

## Project Structure

```
whisper-chat/
├── src/
│   ├── components/
│   │   ├── auth/                    # Login components (LoginArea, AuthDialog, AccountSwitcher)
│   │   ├── ui/                      # shadcn/ui primitives (Button, Dialog, Avatar, etc.)
│   │   ├── whisper/                 # Whisper Chat UI components
│   │   │   ├── ConversationList.tsx # Chat list panel (left sidebar)
│   │   │   ├── MessageThread.tsx    # Message bubbles + chat input (right panel)
│   │   │   ├── NewChatDialog.tsx    # Start new chat / create group dialog
│   │   │   └── SettingsDialog.tsx   # Privacy preferences & presence settings
│   │   ├── AppProvider.tsx          # Global app state provider
│   │   ├── NostrProvider.tsx        # Nostr relay pool provider (NPool, NIP-42 AUTH)
│   │   └── NostrSync.tsx           # Auto-syncs NIP-65 relay list on login
│   ├── hooks/
│   │   ├── useWhisperMessages.ts    # Core messaging: send/receive NIP-17 DMs, receipts, typing
│   │   ├── useConversations.ts      # Orchestrates messages + receipts + settings into conversations
│   │   ├── useDmRelays.ts           # Fetch recipient's NIP-17 DM relay list (kind 10050)
│   │   ├── usePresence.ts           # WIP-04: Online/offline/away presence (kind 14569)
│   │   ├── useGroups.ts             # WIP-05: Group creation & member management
│   │   ├── useConversationSettings.ts # WIP-06: Mute/pin/archive per conversation (kind 33381)
│   │   ├── usePrivacyPreferences.ts # WIP-07: Privacy controls (kind 35281)
│   │   ├── useContacts.ts            # WIP-08: Messaging contacts list (kind 36987)
│   │   ├── useCurrentUser.ts        # Current logged-in Nostr user
│   │   ├── useNostrPublish.ts       # Publish signed Nostr events
│   │   ├── useAuthor.ts             # Fetch kind-0 profile metadata
│   │   └── ...                      # Other hooks (theme, toast, uploads, etc.)
│   ├── lib/
│   │   ├── whisper/
│   │   │   ├── constants.ts         # All Whisper Relay kinds, tags, types, and parsers
│   │   │   ├── giftwrap.ts          # NIP-59 gift wrap utilities (seal, wrap, unwrap)
│   │   │   └── format.ts            # Time and date formatting helpers
│   │   ├── appRelays.ts             # Default relay configuration
│   │   ├── appBlossom.ts            # Default Blossom media servers
│   │   └── utils.ts                 # cn() class merge utility
│   ├── pages/
│   │   ├── ChatPage.tsx             # Main chat page (two-panel WhatsApp-style layout)
│   │   ├── Index.tsx                # Re-exports ChatPage as the index route
│   │   ├── NIP19Page.tsx            # Handles /:nip19 routes (npub, note, naddr, etc.)
│   │   └── NotFound.tsx             # 404 page
│   ├── contexts/
│   │   └── AppContext.ts            # App config types (theme, relays, blossom)
│   ├── App.tsx                      # Root providers (QueryClient, Nostr, App, etc.)
│   ├── AppRouter.tsx                # React Router configuration
│   └── main.tsx                     # App entry point
├── public/
│   └── favicon.svg                  # Whisper Chat logo
├── NIP.md                           # Custom Nostr event kinds documentation
├── AGENTS.md                        # AI agent / development guidelines
├── package.json
├── vite.config.ts
├── tsconfig.json
└── eslint.config.js
```

---

## Getting Started

### Prerequisites

- **Node.js** 18+ (for local development)
- A **Nostr identity** — either:
  - A browser extension (e.g., [nos2x](https://github.com/nostr-band/nos2x), [Alby](https://getalby.com/))
  - An `nsec` (Nostr secret key)
  - A NIP-46 bunker signer

### Installation

```bash
# Clone the repository
git clone https://github.com/Denver-1st/Whisper-chat.git
cd Whisper-chat

# Install dependencies
npm install

# Start the dev server
npm run dev
```

The app will be available at `http://localhost:8080`.

### First Run

1. Open the app in your browser
2. Click **Join** to log in with your Nostr identity
3. Start a new chat by clicking the **pen icon** in the top-right of the chat list
4. Enter a recipient's `npub` or select an existing contact
5. Start messaging!

---

## Development

### Available Scripts

```bash
npm run dev      # Start Vite dev server (hot reload)
npm run build    # Production build → dist/
npm run test     # Full validation: tsc + eslint + vitest + vite build
```

### Type Checking

```bash
npx tsc --noEmit
```

### Linting

```bash
npx eslint --cache
```

### Key Development Notes

- **Never use `any`** — TypeScript strict mode is enforced. All types must be explicit.
- **Read before editing** — Always read `App.tsx`, `AppRouter.tsx`, and `NostrProvider.tsx` before modifying them.
- **NIP-44 encryption** — The signer interface (`user.signer.nip44`) handles all crypto. Never touch private keys directly.
- **Gift wrap pipeline** — See `src/lib/whisper/giftwrap.ts` for the seal → wrap → unwrap flow.
- **Relay pool** — The `NPool` in `NostrProvider.tsx` routes reads to all read-relays and writes to all write-relays. NIP-42 AUTH is handled automatically.

### Environment Variables

This project does not require any environment variables for basic operation. The app connects to Nostr relays configured in `src/lib/appRelays.ts` and uses Blossom servers from `src/lib/appBlossom.ts`.

---

## Configuration

### Default Relays

The app ships with these default relays (configured in `src/lib/appRelays.ts`):

| Relay | Read | Write |
|---|---|---|
| `wss://relay.ditto.pub/` | ✅ | ✅ |
| `wss://relay.dreamith.to/` | ✅ | ✅ |
| `wss://relay.primal.net/` | — | ✅ |
| `wss://relay.damus.io/` | — | ✅ |

Users can customize their relay list in **Settings** (synced via NIP-65 kind 10002).

### Blossom Servers

Default media upload servers (for image/file attachments):

- `https://blossom.ditto.pub/`
- `https://blossom.dreamith.to/`
- `https://blossom.primal.net/`

---

## Deployment

Whisper Chat is a **static single-page application** — the entire app is client-side JavaScript, HTML, and CSS. There is no backend to deploy. The production build outputs to `dist/`.

### Build for Production

```bash
npm run build
```

This produces:
- `dist/index.html` — the HTML entry point
- `dist/assets/` — bundled JS and CSS
- `dist/404.html` — copy of index.html for SPA routing on static hosts

### Deploy with Shakespeare

The easiest way to deploy is directly through [Shakespeare](https://shakespeare.diy):

1. Open your project at `https://shakespeare.diy/project/whisper-chat`
2. Click the **Deploy** button in the project toolbar
3. Choose your deployment provider
4. Your site will be live in seconds

### Deploy to Netlify

1. **Connect your repo** to [Netlify](https://netlify.com)
2. Set the following configuration:
   - **Build command:** `npm run build`
   - **Publish directory:** `dist`
3. Deploy

Or use the Netlify CLI:

```bash
npm install -g netlify-cli
npm run build
netlify deploy --prod --dir=dist
```

### Deploy to Vercel

1. **Import your repo** at [Vercel](https://vercel.com/new)
2. Set the following configuration:
   - **Framework Preset:** Vite
   - **Build command:** `npm run build`
   - **Output directory:** `dist`
3. Deploy

Or use the Vercel CLI:

```bash
npm install -g vercel
vercel --prod
```

### Deploy to Cloudflare Pages

1. Go to [Cloudflare Pages](https://pages.cloudflare.com)
2. **Connect your repository**
3. Set the following configuration:
   - **Framework preset:** None
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Deploy

Or use Wrangler:

```bash
npm install -g wrangler
npm run build
wrangler pages deploy dist
```

### Deploy to nsite

[nsite](https://nsite.co) is a Nostr-native static hosting service:

1. Build the project: `npm run build`
2. Use the nsite CLI to upload the `dist/` folder to Nostr relays
3. Your site will be accessible via an naddr identifier

### Important: SPA Routing

All deployment providers must serve `index.html` for all routes (SPA fallback). The build already copies `index.html` to `404.html` for providers that use 404-based fallback. For providers that need explicit configuration:

- **Netlify:** Add a `_redirects` file in `public/` with `/* /index.html 200`
- **Vercel:** Vite preset handles this automatically
- **Cloudflare Pages:** Set a catch-all redirect rule

### Environment-Specific Notes

- **HTTPS is required** — Nostr relay connections (`wss://`) and browser crypto APIs require HTTPS. All recommended deployment providers serve over HTTPS by default.
- **CSP is configured** — The app ships with a restrictive Content Security Policy in `index.html`. Ensure your deployment provider doesn't inject scripts that violate CSP.
- **No secrets needed** — There are no API keys, database URLs, or server-side secrets to configure. Everything runs in the browser.

---

## Protocol Documentation

Whisper Chat implements the [Whisper Relay protocol](https://github.com/Denver-1st/mprotocol), defined by a series of Whisper Improvement Proposals (WIPs):

| WIP | Title | Status | Kind(s) |
|-----|-------|--------|---------|
| [WIP-00](https://github.com/Denver-1st/mprotocol/blob/main/WIP-00-messaging-foundation.md) | Messaging Foundation | Required | 14, 1059, 21059 |
| [WIP-01](https://github.com/Denver-1st/mprotocol/blob/main/WIP-01-read-receipts.md) | Read Receipts | Required | 1271 |
| [WIP-02](https://github.com/Denver-1st/mprotocol/blob/main/WIP-02-delivery-receipts.md) | Delivery Receipts | Required | 7753 |
| [WIP-03](https://github.com/Denver-1st/mprotocol/blob/main/WIP-03-typing-indicators.md) | Typing Indicators | Required | 14 (ephemeral) |
| [WIP-04](https://github.com/Denver-1st/mprotocol/blob/main/WIP-04-messaging-presence.md) | Messaging Presence | Required | 14569 |
| [WIP-05](https://github.com/Denver-1st/mprotocol/blob/main/WIP-05-private-group-metadata.md) | Private Group Metadata | Required | 14 (group_action) |
| [WIP-06](https://github.com/Denver-1st/mprotocol/blob/main/WIP-06-conversation-settings.md) | Conversation Settings | Required | 33381 |
| [WIP-07](https://github.com/Denver-1st/mprotocol/blob/main/WIP-07-privacy-preferences.md) | Privacy Preferences | Required | 35281 |
| [WIP-08](https://github.com/Denver-1st/mprotocol/blob/main/WIP-08-contacts-list.md) | Contacts List | Required | 36987 |

See [`NIP.md`](./NIP.md) for the full schema of each custom event kind.

### Underlying Nostr NIPs

| NIP | Name | Purpose |
|-----|------|---------|
| [NIP-01](https://github.com/nostr-protocol/nips/blob/master/01.md) | Basic Protocol Flow | Event model, relays |
| [NIP-02](https://github.com/nostr-protocol/nips/blob/master/02.md) | Follow List | Social follows (used for "contacts" definition) |
| [NIP-17](https://github.com/nostr-protocol/nips/blob/master/17.md) | Private Direct Messages | Gift-wrapped DM transport |
| [NIP-19](https://github.com/nostr-protocol/nips/blob/master/19.md) | bech32-encoded entities | npub, note, naddr identifiers |
| [NIP-42](https://github.com/nostr-protocol/nips/blob/master/42.md) | Relay Authentication | AUTH for protected relays |
| [NIP-44](https://github.com/nostr-protocol/nips/blob/master/44.md) | Encrypted Payloads | End-to-end encryption |
| [NIP-51](https://github.com/nostr-protocol/nips/blob/master/51.md) | Lists | Private items encryption pattern |
| [NIP-59](https://github.com/nostr-protocol/nips/blob/master/59.md) | Gift Wrap | Seal + wrap for rumor transport |
| [NIP-65](https://github.com/nostr-protocol/nips/blob/master/65.md) | Relay List Metadata | User's preferred relays |

---

## Security Model

### End-to-End Encryption

All message content is encrypted with **NIP-44** (authenticated encryption) and transported via **NIP-59 gift wraps**. The encryption pipeline:

1. **Rumor** — unsigned event with message content (kind 14)
2. **Seal** — NIP-44 encrypt the rumor to the recipient using a one-time key (kind 13)
3. **Gift Wrap** — NIP-44 encrypt the seal to the recipient using another one-time key (kind 1059)

Each layer uses a fresh, random key pair. Relays and third parties cannot link gift wraps to senders or recipients.

### What Relays Can See

Relays **can** see:
- Opaque encrypted blobs (kind 1059 events)
- One-time pubkeys (not linked to real identities)
- Timestamps of gift wrap events

Relays **cannot** see:
- Message content
- Who is messaging whom
- Group names, membership, or metadata
- Read/delivery receipt contents
- Typing indicator contents (ephemeral wraps aren't even stored)

### Private Key Handling

Nostr private keys (`nsec`) are stored in the browser's `localStorage`. The app uses the Nostrify signer interface for all cryptographic operations — private keys are never directly accessed by application code. However, any JavaScript running on the same origin can access `localStorage`. The app enforces a strict Content Security Policy as defense-in-depth.

### Privacy Controls

Users can independently control who sees:
- Their last-seen status (everyone / contacts / nobody)
- Read receipts (everyone / contacts / nobody)
- Typing indicators (everyone / contacts / nobody)
- Profile photo (everyone / contacts / nobody)
- Their presence entirely (hide_presence toggle)
- Who can add them to groups (everyone / contacts)

---

## Contributing

This project implements the Whisper Relay protocol specification. When contributing:

1. Read the relevant WIP documents first
2. Keep one WIP as the primary source of truth for each feature
3. Follow the existing code patterns (React hooks + Nostrify + TanStack Query)
4. Never use `any` — all TypeScript types must be explicit
5. Run `npm run test` before submitting changes
6. Update `NIP.md` when adding or changing custom event kinds

### Code Style

- Components follow the shadcn/ui pattern: `React.ComponentProps<>`, `ref` as prop, `data-slot` attribute, `cn()` for class merging
- Hooks combine `useNostr()` with `useQuery`/`useMutation` from TanStack Query
- Nostr events are validated with parser functions before use
- All URLs from event data are sanitized before rendering

---

## License

Public domain. See the [Whisper Relay protocol repository](https://github.com/Denver-1st/mprotocol) for details.

---

