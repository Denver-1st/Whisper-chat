/**
 * WIP-06: Conversation Settings (kind 33381, addressable).
 * Per-conversation mute, pin, archive, and wallpaper.
 */
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import {
  KIND_CONVERSATION_SETTINGS,
  TAG_MUTED,
  TAG_MUTE_DURATION,
  TAG_PINNED,
  TAG_PIN_ORDER,
  TAG_ARCHIVED,
  TAG_WALLPAPER,
  parseConversationSettings,
  type WhisperConversationSettings,
} from '@/lib/whisper/constants';

/** Fetch all conversation settings for the current user. */
export function useConversationSettings() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<Map<string, WhisperConversationSettings>>({
    queryKey: ['nostr', 'conversation-settings', user?.pubkey ?? ''],
    queryFn: async (c) => {
      if (!user) return new Map();

      const events = await nostr.query(
        [{ kinds: [KIND_CONVERSATION_SETTINGS], authors: [user.pubkey], limit: 100 }],
        { signal: c.signal },
      );

      const map = new Map<string, WhisperConversationSettings>();
      for (const event of events) {
        const settings = parseConversationSettings(event);
        if (settings.conversationId) {
          map.set(settings.conversationId, settings);
        }
      }
      return map;
    },
    enabled: !!user,
  });
}

/** Update conversation settings. Creates/updates a kind 33381 event. */
export function useUpdateConversationSettings() {
  const { mutateAsync: publish } = useNostrPublish();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (settings: WhisperConversationSettings) => {
      if (!user) throw new Error('User not logged in');

      const tags: string[][] = [['d', settings.conversationId]];

      if (settings.muted) {
        tags.push([TAG_MUTED, 'true']);
        if (settings.muteDuration) {
          tags.push([TAG_MUTE_DURATION, String(settings.muteDuration)]);
        }
      }

      if (settings.pinned) {
        tags.push([TAG_PINNED, 'true']);
        tags.push([TAG_PIN_ORDER, String(settings.pinOrder ?? 0)]);
      }

      if (settings.archived) {
        tags.push([TAG_ARCHIVED, 'true']);
      }

      if (settings.wallpaper) {
        tags.push([TAG_WALLPAPER, settings.wallpaper]);
      }

      if (settings.peerPubkey) {
        tags.push(['p', settings.peerPubkey]);
      }

      return publish({
        kind: KIND_CONVERSATION_SETTINGS,
        content: '',
        tags,
      });
    },
  });
}
