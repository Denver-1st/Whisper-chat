/**
 * Core messaging hook implementing WIP-00 (Messaging Foundation).
 *
 * Handles:
 * - Sending NIP-17 gift-wrapped direct messages (kind 14 rumors)
 * - Receiving and unwrapping incoming gift-wrapped messages
 * - Sending delivery receipts (WIP-02)
 * - Sending read receipts (WIP-01)
 * - Sending typing indicators (WIP-03)
 *
 * Messages are stored locally and queried from relays via TanStack Query.
 */

import { useNostr } from '@nostrify/react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useRef } from 'react';

import { useCurrentUser } from './useCurrentUser';

import {
  createRumor,
  giftWrap,
  giftWrapToMany,
  unwrapGiftWrap,
} from '@/lib/whisper/giftwrap';
import {
  KIND_CHAT_MESSAGE,
  KIND_GIFT_WRAP,
  KIND_EPHEMERAL_GIFT_WRAP,
  KIND_READ_RECEIPT,
  KIND_DELIVERED_RECEIPT,
  TAG_TYPING,
  TAG_READ_AT,
  TAG_DELIVERED_AT,
  isChatMessageRumor,
  isTypingRumor,
  isGroupMetadataRumor,
  type WhisperMessage,
  type WhisperReceipt,
  type WhisperTyping,
  getPTags,
  getTagValue,
  type NostrEvent,
} from '@/lib/whisper/constants';

/**
 * Fetch a user's NIP-17 DM relay list (kind 10050).
 * Returns the relay URLs the user wants gift-wrapped messages published to.
 */
async function fetchDmRelays(
  nostr: ReturnType<typeof useNostr>['nostr'],
  pubkey: string,
): Promise<string[]> {
  try {
    const [event] = await nostr.query(
      [{ kinds: [10050], authors: [pubkey], limit: 1 }],
      { signal: AbortSignal.timeout(3000) },
    );
    if (!event) return [];
    return event.tags
      .filter(([n]) => n === 'relay')
      .map(([, url]) => url)
      .filter(Boolean);
  } catch {
    return [];
  }
}

/**
 * Publish gift-wrapped events to the recipient's DM relays.
 * Falls back to the app's default write relays (via the pool's event router)
 * if no DM relays are found.
 */
export async function publishGiftWraps(
  nostr: ReturnType<typeof useNostr>['nostr'],
  wraps: NostrEvent[],
  recipientPubkeys: string[],
): Promise<void> {
  // Collect target relays from all recipients' DM relay lists
  const targetRelays = new Set<string>();

  for (const pubkey of recipientPubkeys) {
    const relays = await fetchDmRelays(nostr, pubkey);
    relays.forEach((r) => targetRelays.add(r));
  }

  if (targetRelays.size === 0) {
    // No DM relays found — fall back to the pool's event router
    // which publishes to all configured write relays
    for (const wrap of wraps) {
      try {
        await nostr.event(wrap, { signal: AbortSignal.timeout(5000) });
      } catch (err) {
        console.warn('Failed to publish gift wrap via pool', err);
      }
    }
    return;
  }

  // Publish to each target relay
  for (const wrap of wraps) {
    for (const relayUrl of targetRelays) {
      try {
        const relay = nostr.relay(relayUrl);
        await relay.event(wrap, { signal: AbortSignal.timeout(5000) });
      } catch (err) {
        console.warn(`Failed to publish to ${relayUrl}`, err);
      }
    }
  }
}

/**
 * Fetch gift-wrapped events addressed to the current user.
 * Returns the raw kind 1059 events (not yet unwrapped).
 */
export function useGiftWraps() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<NostrEvent[]>({
    queryKey: ['nostr', 'gift-wraps', user?.pubkey ?? ''],
    queryFn: async (c) => {
      if (!user) return [];

      const events = await nostr.query(
        [
          {
            kinds: [KIND_GIFT_WRAP, KIND_EPHEMERAL_GIFT_WRAP],
            '#p': [user.pubkey],
            limit: 500,
          },
        ],
        { signal: c.signal },
      );

      return events;
    },
    enabled: !!user,
    refetchInterval: 5000, // Poll for new messages
  });
}

/**
 * Unwrap gift-wrapped events for the current user.
 * Returns decrypted rumors. Caches unwrapped results to avoid re-decrypting.
 */
export function useUnwrappedMessages() {
  const { user } = useCurrentUser();
  const { data: giftWraps, isLoading } = useGiftWraps();
  const unwrappedCache = useRef<Map<string, { rumor: NostrEvent; seal: NostrEvent }>>(new Map());

  const { data: unwrapped, refetch } = useQuery<{
    messages: WhisperMessage[];
    receipts: WhisperReceipt[];
    typing: WhisperTyping[];
    groupMetadata: NostrEvent[];
  }>({
    queryKey: ['whisper', 'unwrapped', user?.pubkey ?? '', giftWraps?.map((e) => e.id).join(',') ?? ''],
    queryFn: async () => {
      if (!user || !giftWraps || giftWraps.length === 0) {
        return { messages: [], receipts: [], typing: [], groupMetadata: [] };
      }

      const messages: WhisperMessage[] = [];
      const receipts: WhisperReceipt[] = [];
      const typing: WhisperTyping[] = [];
      const groupMetadata: NostrEvent[] = [];

      for (const wrap of giftWraps) {
        // Skip already-unwrapped events
        if (unwrappedCache.current.has(wrap.id)) {
          const cached = unwrappedCache.current.get(wrap.id)!;
          processRumor(cached.rumor, wrap, user.pubkey, messages, receipts, typing, groupMetadata);
          continue;
        }

        try {
          const result = await unwrapGiftWrap(wrap, user.signer);
          unwrappedCache.current.set(wrap.id, result);
          processRumor(result.rumor, wrap, user.pubkey, messages, receipts, typing, groupMetadata);
        } catch (err) {
          console.warn('Failed to unwrap gift wrap', wrap.id, err);
        }
      }

      // Deduplicate messages by rumor id
      const uniqueMessages = deduplicateById(messages);

      // Sort messages by created_at
      uniqueMessages.sort((a, b) => a.createdAt - b.createdAt);

      return {
        messages: uniqueMessages,
        receipts: deduplicateReceipts(receipts),
        typing,
        groupMetadata,
      };
    },
    enabled: !!user && !!giftWraps,
  });

  return {
    data: unwrapped,
    isLoading,
    refetch,
  };
}

function processRumor(
  rumor: NostrEvent,
  _wrap: NostrEvent,
  currentUserPubkey: string,
  messages: WhisperMessage[],
  receipts: WhisperReceipt[],
  typing: WhisperTyping[],
  groupMetadata: NostrEvent[],
) {
  // Handle chat messages
  if (isChatMessageRumor(rumor)) {
    const groupId = getTagValue(rumor, 'group');
    const isGroup = groupId !== undefined;
    const peerPubkeys = getPTags(rumor).filter((p) => p !== rumor.pubkey);
    const peerPubkey = peerPubkeys[0] ?? '';

    const msg: WhisperMessage = {
      id: rumor.id,
      senderPubkey: rumor.pubkey,
      content: rumor.content,
      createdAt: rumor.created_at,
      tags: rumor.tags,
      conversationId: isGroup ? groupId! : (rumor.pubkey === currentUserPubkey ? peerPubkey : rumor.pubkey),
      isGroup,
      groupId,
    };
    messages.push(msg);
    return;
  }

  // Handle typing indicators
  if (isTypingRumor(rumor)) {
    const groupId = getTagValue(rumor, 'group');
    const isGroup = groupId !== undefined;
    const peerPubkeys = getPTags(rumor).filter((p) => p !== rumor.pubkey);
    const peerPubkey = peerPubkeys[0] ?? '';

    const t: WhisperTyping = {
      senderPubkey: rumor.pubkey,
      isTyping: getTagValue(rumor, TAG_TYPING) === 'true',
      conversationId: isGroup ? groupId! : (rumor.pubkey === currentUserPubkey ? peerPubkey : rumor.pubkey),
      timestamp: rumor.created_at,
    };
    typing.push(t);
    return;
  }

  // Handle group metadata
  if (isGroupMetadataRumor(rumor)) {
    groupMetadata.push(rumor);
    return;
  }

  // Handle read receipts (kind 1271)
  if (rumor.kind === KIND_READ_RECEIPT) {
    const messageIds = rumor.tags.filter(([n]) => n === 'e').map(([, v]) => v);
    const peerPubkey = getTagValue(rumor, 'p') ?? '';
    const timestamp = getTagValue(rumor, TAG_READ_AT)
      ? Number(getTagValue(rumor, TAG_READ_AT))
      : rumor.created_at;

    receipts.push({
      type: 'read',
      messageIds,
      senderPubkey: rumor.pubkey,
      timestamp,
      conversationId: peerPubkey,
    });
    return;
  }

  // Handle delivery receipts (kind 7753)
  if (rumor.kind === KIND_DELIVERY_RECEIPT) {
    const messageIds = rumor.tags.filter(([n]) => n === 'e').map(([, v]) => v);
    const peerPubkey = getTagValue(rumor, 'p') ?? '';
    const timestamp = getTagValue(rumor, TAG_DELIVERED_AT)
      ? Number(getTagValue(rumor, TAG_DELIVERED_AT))
      : rumor.created_at;

    receipts.push({
      type: 'delivered',
      messageIds,
      senderPubkey: rumor.pubkey,
      timestamp,
      conversationId: peerPubkey,
    });
    return;
  }
}

function deduplicateById(messages: WhisperMessage[]): WhisperMessage[] {
  const seen = new Set<string>();
  const result: WhisperMessage[] = [];
  for (const msg of messages) {
    if (!seen.has(msg.id)) {
      seen.add(msg.id);
      result.push(msg);
    }
  }
  return result;
}

function deduplicateReceipts(receipts: WhisperReceipt[]): WhisperReceipt[] {
  const seen = new Set<string>();
  const result: WhisperReceipt[] = [];
  for (const r of receipts) {
    const key = `${r.type}:${r.senderPubkey}:${r.messageIds.join(',')}`;
    if (!seen.has(key)) {
      seen.add(key);
      result.push(r);
    }
  }
  return result;
}

/**
 * Send a direct message to a single recipient.
 * Creates a kind 14 rumor, gift-wraps it, and publishes to the recipient's DM relays.
 */
export function useSendMessage() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      content,
      recipientPubkey,
      groupId,
      groupMembers,
      replyTo,
    }: {
      content: string;
      recipientPubkey?: string;        // for 1:1 chat
      groupId?: string;                 // for group chat
      groupMembers?: string[];          // all group member pubkeys
      replyTo?: string;                 // rumor ID being replied to
    }) => {
      if (!user) throw new Error('User not logged in');

      // Build tags
      const tags: string[][] = [];

      if (groupId && groupMembers) {
        // Group message
        tags.push(['group', groupId]);
        for (const member of groupMembers) {
          tags.push(['p', member]);
        }
      } else if (recipientPubkey) {
        // Direct message
        tags.push(['p', recipientPubkey]);
      } else {
        throw new Error('Must specify recipientPubkey or groupId+groupMembers');
      }

      if (replyTo) {
        tags.push(['e', replyTo]);
      }

      // Create the rumor
      const rumor = createRumor(
        { kind: KIND_CHAT_MESSAGE, content, tags },
        user.pubkey,
      );

      // Determine recipients for gift wrapping (all other members + self)
      const recipients = groupId && groupMembers
        ? groupMembers.filter((p) => p !== user.pubkey)
        : [recipientPubkey!];

      // Also gift-wrap to self (so we can see our own messages on other devices)
      recipients.push(user.pubkey);

      // Gift-wrap for each recipient
      const wraps = giftWrapToMany(rumor, recipients);

      // Publish to recipients' DM relays (falls back to pool's write relays)
      await publishGiftWraps(nostr, wraps, recipients);

      return rumor;
    },
  });
}

/**
 * Send a read receipt for one or more messages.
 * WIP-01: kind 1271 rumor, gift-wrapped to the original sender.
 */
export function useSendReadReceipt() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      messageIds,
      senderPubkey,
    }: {
      messageIds: string[];
      senderPubkey: string;
    }) => {
      if (!user) throw new Error('User not logged in');

      const tags: string[][] = [
        ['p', senderPubkey],
        ...messageIds.map((id) => ['e', id] as string[]),
        [TAG_READ_AT, String(Math.floor(Date.now() / 1000))],
      ];

      const rumor = createRumor(
        { kind: KIND_READ_RECEIPT, content: '', tags },
        user.pubkey,
      );

      const wrap = giftWrap(rumor, senderPubkey);

      await publishGiftWraps(nostr, [wrap], [senderPubkey]);

      return rumor;
    },
  });
}

/**
 * Send a delivery receipt for one or more messages.
 * WIP-02: kind 7753 rumor, gift-wrapped to the original sender.
 */
export function useSendDeliveryReceipt() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      messageIds,
      senderPubkey,
    }: {
      messageIds: string[];
      senderPubkey: string;
    }) => {
      if (!user) throw new Error('User not logged in');

      const tags: string[][] = [
        ['p', senderPubkey],
        ...messageIds.map((id) => ['e', id] as string[]),
        [TAG_DELIVERED_AT, String(Math.floor(Date.now() / 1000))],
      ];

      const rumor = createRumor(
        { kind: KIND_DELIVERY_RECEIPT, content: '', tags },
        user.pubkey,
      );

      const wrap = giftWrap(rumor, senderPubkey);

      await publishGiftWraps(nostr, [wrap], [senderPubkey]);

      return rumor;
    },
  });
}

/**
 * Send a typing indicator.
 * WIP-03: kind 14 rumor with typing tag, ephemeral gift wrap (kind 21059).
 *
 * This is fire-and-forget — errors are caught and logged, never thrown.
 */
export function useSendTypingIndicator() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      recipientPubkey,
      groupId,
      groupMembers,
      isTyping,
    }: {
      recipientPubkey?: string;
      groupId?: string;
      groupMembers?: string[];
      isTyping: boolean;
    }) => {
      if (!user) throw new Error('User not logged in');

      const tags: string[][] = [[TAG_TYPING, isTyping ? 'true' : 'false']];

      if (groupId && groupMembers) {
        tags.push(['group', groupId]);
        for (const member of groupMembers) {
          tags.push(['p', member]);
        }
      } else if (recipientPubkey) {
        tags.push(['p', recipientPubkey]);
      }

      const rumor = createRumor(
        { kind: KIND_CHAT_MESSAGE, content: '', tags },
        user.pubkey,
      );

      const recipients = groupId && groupMembers
        ? groupMembers.filter((p) => p !== user.pubkey)
        : [recipientPubkey!];

      // Use ephemeral gift wraps (kind 21059)
      const wraps = giftWrapToMany(rumor, recipients, true);

      // Publish fire-and-forget — typing indicators are best-effort
      publishGiftWraps(nostr, wraps, recipients).catch((err) => {
        console.warn('Failed to publish typing indicator', err);
      });

      return rumor;
    },
  });
}
