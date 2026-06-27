/**
 * WIP-04: Messaging Presence (kind 14569, replaceable).
 * Publish and fetch online/offline/away status.
 */
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import {
  KIND_PRESENCE,
  TAG_STATUS,
  TAG_LAST_SEEN,
  TAG_AVAILABILITY,
  TAG_EXPIRATION,
  parsePresence,
  type PresenceStatus,
  type WhisperPresence,
} from '@/lib/whisper/constants';

/** Fetch presence for a pubkey. */
export function usePresence(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<WhisperPresence | undefined>({
    queryKey: ['nostr', 'presence', pubkey ?? ''],
    queryFn: async (c) => {
      if (!pubkey) return undefined;

      const [event] = await nostr.query(
        [{ kinds: [KIND_PRESENCE], authors: [pubkey], limit: 1 }],
        { signal: c.signal },
      );

      return parsePresence(event);
    },
    staleTime: 30 * 1000, // 30 seconds
    enabled: !!pubkey,
    refetchInterval: 60 * 1000, // Refresh every minute
  });
}

/** Fetch presence for multiple pubkeys (e.g., all contacts). */
export function usePresenceBatch(pubkeys: string[]) {
  const { nostr } = useNostr();

  return useQuery<Map<string, WhisperPresence>>({
    queryKey: ['nostr', 'presence-batch', pubkeys.join(',') ?? ''],
    queryFn: async (c) => {
      if (pubkeys.length === 0) return new Map();

      const events = await nostr.query(
        [{ kinds: [KIND_PRESENCE], authors: pubkeys, limit: pubkeys.length }],
        { signal: c.signal },
      );

      const map = new Map<string, WhisperPresence>();
      for (const event of events) {
        const presence = parsePresence(event);
        if (presence) {
          // Check if presence is stale (expired)
          if (presence.expiration && Date.now() / 1000 > presence.expiration) {
            presence.status = 'offline';
            presence.lastSeen = presence.createdAt;
          }
          map.set(event.pubkey, presence);
        }
      }
      return map;
    },
    staleTime: 30 * 1000,
    enabled: pubkeys.length > 0,
    refetchInterval: 60 * 1000,
  });
}

/** Publish presence status. */
export function usePublishPresence() {
  const { mutateAsync: publish } = useNostrPublish();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      status,
      availability,
      customMessage,
    }: {
      status: PresenceStatus;
      availability?: string;
      customMessage?: string;
    }) => {
      if (!user) throw new Error('User not logged in');

      const now = Math.floor(Date.now() / 1000);
      const tags: string[][] = [[TAG_STATUS, status]];

      if (status === 'online') {
        // Set expiration to 5 minutes from now
        tags.push([TAG_EXPIRATION, String(now + 300)]);
      } else {
        tags.push([TAG_LAST_SEEN, String(now)]);
      }

      if (availability) {
        tags.push([TAG_AVAILABILITY, availability]);
      }

      return publish({
        kind: KIND_PRESENCE,
        content: customMessage ?? '',
        tags,
        created_at: now,
      });
    },
  });
}
