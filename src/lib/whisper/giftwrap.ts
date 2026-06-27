/**
 * NIP-59 gift wrap utilities for Whisper Relay.
 *
 * Implements:
 * - Creating rumors (unsigned events with computed IDs)
 * - Sealing rumors (NIP-59 kind 13) using NIP-44 encryption
 * - Gift-wrapping sealed events (NIP-59 kind 1059)
 * - Ephemeral gift wrapping (kind 21059, not stored by relays)
 * - Unwrapping gift wraps to reveal the inner rumor
 *
 * Uses nostr-tools for crypto primitives.
 */

import {
  generateSecretKey,
  finalizeEvent,
  getEventHash,
  type EventTemplate,
  type NostrEvent as NToolsEvent,
} from 'nostr-tools/pure';
import { nip44 } from 'nostr-tools';
import type { NostrSigner } from '@nostrify/nostrify';
import type { NostrEvent } from '@nostrify/nostrify';
import {
  KIND_SEAL,
  KIND_GIFT_WRAP,
  KIND_EPHEMERAL_GIFT_WRAP,
} from './constants';

// nostr-tools EventTemplate is compatible with our NostrEvent structure
type EventTemplateLike = EventTemplate;

// ─── Rumor Creation ──────────────────────────────────────────

/**
 * Create a rumor (unsigned event). The `id` is computed but `sig` is empty.
 * This is the canonical message format for NIP-17 and Whisper Relay.
 */
export function createRumor(template: EventTemplateLike, authorPubkey: string): NostrEvent {
  const event: NostrEvent = {
    kind: template.kind,
    content: template.content ?? '',
    tags: template.tags ?? [],
    created_at: template.created_at ?? Math.floor(Date.now() / 1000),
    pubkey: authorPubkey,
    sig: '',
    id: '',
  };
  // Compute the event hash as the canonical rumor ID
  event.id = getEventHash(event as unknown as NToolsEvent);
  return event;
}

// ─── Sealing ────────────────────────────────────────────────

/**
 * Seal a rumor for a recipient. Creates a kind 13 sealed event.
 * The seal is signed by a one-time key and encrypts the rumor using NIP-44.
 */
export function sealRumor(
  rumor: NostrEvent,
  recipientPubkey: string,
): NostrEvent {
  const rumorJson = JSON.stringify(rumor);

  // Generate a one-time key for the seal
  const sealKey = generateSecretKey();

  // The seal encrypts the rumor to the recipient using the one-time key
  const sealTemplate: EventTemplateLike = {
    kind: KIND_SEAL,
    content: encryptWithNip44(sealKey, recipientPubkey, rumorJson),
    tags: [['p', recipientPubkey]],
    created_at: Math.floor(Date.now() / 1000) - 1,
  };

  const seal = finalizeEvent(sealTemplate, sealKey) as unknown as NostrEvent;
  return seal;
}

// ─── Gift Wrapping ──────────────────────────────────────────

/**
 * Gift-wrap a sealed event for a recipient.
 * Creates a kind 1059 event (or 21059 for ephemeral).
 */
export function wrapSeal(
  seal: NostrEvent,
  recipientPubkey: string,
  ephemeral = false,
): NostrEvent {
  const wrapKey = generateSecretKey();

  const wrapTemplate: EventTemplateLike = {
    kind: ephemeral ? KIND_EPHEMERAL_GIFT_WRAP : KIND_GIFT_WRAP,
    content: encryptWithNip44(wrapKey, recipientPubkey, JSON.stringify(seal)),
    tags: [['p', recipientPubkey]],
    created_at: Math.floor(Date.now() / 1000),
  };

  return finalizeEvent(wrapTemplate, wrapKey) as unknown as NostrEvent;
}

/**
 * Full gift-wrap pipeline: create seal → wrap.
 * Returns the gift-wrapped event ready to publish.
 * The signer is used for unwrapping (decryption), not for sealing.
 */
export function giftWrap(
  rumor: NostrEvent,
  recipientPubkey: string,
  ephemeral = false,
): NostrEvent {
  const seal = sealRumor(rumor, recipientPubkey);
  return wrapSeal(seal, recipientPubkey, ephemeral);
}

/**
 * Gift-wrap a rumor to multiple recipients. Returns one gift-wrapped event per recipient.
 */
export function giftWrapToMany(
  rumor: NostrEvent,
  recipientPubkeys: string[],
  ephemeral = false,
): NostrEvent[] {
  return recipientPubkeys.map((pubkey) => giftWrap(rumor, pubkey, ephemeral));
}

// ─── Unwrapping ─────────────────────────────────────────────

/**
 * Unwrap a gift-wrapped event to reveal the inner seal and rumor.
 * Uses the signer's NIP-44 decrypt capability.
 */
export async function unwrapGiftWrap(
  giftWrapEvent: NostrEvent,
  signer: NostrSigner,
): Promise<{ rumor: NostrEvent; seal: NostrEvent }> {
  // The gift wrap author is a one-time key. Decrypt the content to get the seal.
  const sealJson = await decryptNip44(signer, giftWrapEvent.pubkey, giftWrapEvent.content);
  const seal = JSON.parse(sealJson) as NostrEvent;

  // The seal author is also a one-time key. Decrypt to get the rumor.
  const rumorJson = await decryptNip44(signer, seal.pubkey, seal.content);
  const rumor = JSON.parse(rumorJson) as NostrEvent;

  return { rumor, seal };
}

// ─── NIP-44 Helpers ─────────────────────────────────────────

/**
 * Decrypt using NIP-44 via the signer interface.
 */
export async function decryptNip44(
  signer: NostrSigner,
  peerPubkey: string,
  ciphertext: string,
): Promise<string> {
  if (signer.nip44) {
    return signer.nip44.decrypt(peerPubkey, ciphertext);
  }
  throw new Error('Signer does not support NIP-44 decryption');
}

/**
 * Encrypt using a raw secret key (for one-time seal/wrap keys).
 * Uses nostr-tools nip44 directly.
 */
function encryptWithNip44(
  secretKey: Uint8Array,
  recipientPubkey: string,
  plaintext: string,
): string {
  // nip44.encrypt takes (conversationKey, plaintext)
  // conversationKey = nip44.getConversationKey(secretKey, recipientPubkey)
  const conversationKey = nip44.getConversationKey(secretKey, recipientPubkey);
  return nip44.encrypt(conversationKey, plaintext);
}
