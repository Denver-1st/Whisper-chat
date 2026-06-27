/**
 * Fetch a user's NIP-17 DM relay list (kind 10050).
 * This tells us which relays to publish gift-wrapped messages to for that user.
 * WIP-00: Clients MUST only publish gift-wrapped events to the recipient's kind 10050 relays.
 */
import { useNostr } from '@nostrify/react';
import { useQuery } from '@tanstack/react-query';
import { KIND_DM_RELAY_LIST } from '@/lib/whisper/constants';

export function useDmRelays(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<string[]>({
    queryKey: ['nostr', 'dm-relays', pubkey ?? ''],
    queryFn: async (c) => {
      if (!pubkey) return [];

      const [event] = await nostr.query(
        [{ kinds: [KIND_DM_RELAY_LIST], authors: [pubkey], limit: 1 }],
        { signal: c.signal },
      );

      if (!event) return [];

      return event.tags
        .filter(([n]) => n === 'relay')
        .map(([, url]) => url)
        .filter(Boolean);
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    enabled: !!pubkey,
  });
}
