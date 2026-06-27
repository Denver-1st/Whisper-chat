# Whisper Relay — Custom Event Kinds

This document describes the custom Nostr event kinds used by Whisper Chat, a WhatsApp-style instant messaging client implementing the [Whisper Relay protocol](https://github.com/Denver-1st/mprotocol) (WIP-00 through WIP-08).

## Protocol Foundation

Whisper Relay builds on existing Nostr NIPs:
- **NIP-17** — Private direct messages (gift-wrapped DMs)
- **NIP-44** — Encrypted payloads
- **NIP-59** — Gift wrap (seal + wrap)
- **NIP-65** — Relay list metadata
- **NIP-42** — Authentication to relays

All message content, receipts, typing indicators, and group metadata are **rumors** (unsigned events) sealed and gift-wrapped via NIP-59. Presence, privacy preferences, conversation settings, and contacts are **signed** personal events.

## Custom Event Kinds

### Kind 1271 — Read Receipt (WIP-01)

- **Type:** Regular (gift-wrapped rumor)
- **Purpose:** Signals that a recipient has read specific message(s).
- **Tags:** `e` (message rumor IDs), `p` (original sender pubkey), `read_at` (optional timestamp).
- **Content:** Empty string.

### Kind 7753 — Delivery Receipt (WIP-02)

- **Type:** Regular (gift-wrapped rumor)
- **Purpose:** Signals that a message has been delivered to the recipient's device.
- **Tags:** `e` (message rumor IDs), `p` (original sender pubkey), `delivered_at` (optional timestamp).
- **Content:** Empty string.

### Kind 14569 — Messaging Presence (WIP-04)

- **Type:** Replaceable
- **Purpose:** Online/offline/away status with optional last-seen and availability.
- **Tags:** `status` (online/offline/away), `last_seen` (optional), `availability` (optional), `expiration` (optional).
- **Content:** Optional custom status message (plain text).

### Kind 33381 — Conversation Settings (WIP-06)

- **Type:** Addressable
- **Purpose:** Per-conversation mute, pin, archive, and wallpaper preferences.
- **Tags:** `d` (conversation ID), `muted`, `mute_duration`, `pinned`, `pin_order`, `archived`, `p`, `wallpaper`.
- **Content:** Empty string.

### Kind 35281 — Privacy Preferences (WIP-07)

- **Type:** Addressable
- **Purpose:** Controls who can see last-seen, receipts, typing indicators, and profile photo.
- **Tags:** `d` ("global"), `last_seen`, `read_receipts`, `typing_indicators`, `profile_photo`, `hide_presence`, `groups_add_me`.
- **Content:** Empty string.

### Kind 36987 — Messaging Contacts List (WIP-08)

- **Type:** Addressable
- **Purpose:** Messaging-native address book with petnames, separate from NIP-02 follows.
- **Tags:** `d` ("contacts"), `p` (one per contact, with optional relay + petname), `title`.
- **Content:** May contain NIP-44 encrypted private contacts.

## Typing Indicators (WIP-03)

Typing indicators do **not** use a new event kind. They are kind 14 rumors (NIP-17 chat messages) with empty content and a `typing` tag, wrapped in **ephemeral** gift wraps (kind 21059).

## Group Metadata (WIP-05)

Group metadata also does not use a new event kind. It is carried by tags on kind 14 rumors with empty content: `group`, `group_action`, `group_name`, `group_about`, `group_picture`, `group_admins`, and member `p` tags.
