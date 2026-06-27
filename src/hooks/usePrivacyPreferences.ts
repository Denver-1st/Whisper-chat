/**
 * WIP-07: Privacy Preferences (kind 35281, addressable).
 * Controls who can see last-seen, receipts, typing, and profile photo.
 */
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import {
  KIND_PRIVACY_PREFERENCES,
  TAG_HIDE_PRESENCE,
  TAG_GROUPS_ADD_ME,
  DEFAULT_PRIVACY_PREFERENCES,
  parsePrivacyPreferences,
  type WhisperPrivacyPreferences,
  type PrivacyLevel,
} from '@/lib/whisper/constants';

/** Fetch the current user's privacy preferences. */
export function useMyPrivacyPreferences() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<WhisperPrivacyPreferences>({
    queryKey: ['nostr', 'privacy-preferences', user?.pubkey ?? ''],
    queryFn: async (c) => {
      if (!user) return { ...DEFAULT_PRIVACY_PREFERENCES };

      const [event] = await nostr.query(
        [{ kinds: [KIND_PRIVACY_PREFERENCES], authors: [user.pubkey], '#d': ['global'], limit: 1 }],
        { signal: c.signal },
      );

      return parsePrivacyPreferences(event);
    },
    enabled: !!user,
  });
}

/** Fetch a peer's privacy preferences (to decide whether to send receipts/typing). */
export function usePeerPrivacyPreferences(pubkey: string | undefined) {
  const { nostr } = useNostr();

  return useQuery<WhisperPrivacyPreferences>({
    queryKey: ['nostr', 'privacy-preferences', pubkey ?? ''],
    queryFn: async (c) => {
      if (!pubkey) return { ...DEFAULT_PRIVACY_PREFERENCES };

      const [event] = await nostr.query(
        [{ kinds: [KIND_PRIVACY_PREFERENCES], authors: [pubkey], '#d': ['global'], limit: 1 }],
        { signal: c.signal },
      );

      return parsePrivacyPreferences(event);
    },
    staleTime: 5 * 60 * 1000,
    enabled: !!pubkey,
  });
}

/** Update the current user's privacy preferences. */
export function useUpdatePrivacyPreferences() {
  const { mutateAsync: publish } = useNostrPublish();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (prefs: WhisperPrivacyPreferences) => {
      if (!user) throw new Error('User not logged in');

      const tags: string[][] = [['d', 'global']];

      tags.push(['last_seen', prefs.lastSeen]);
      tags.push(['read_receipts', prefs.readReceipts]);
      tags.push(['typing_indicators', prefs.typingIndicators]);
      tags.push(['profile_photo', prefs.profilePhoto]);
      tags.push([TAG_GROUPS_ADD_ME, prefs.groupsAddMe]);

      if (prefs.hidePresence) {
        tags.push([TAG_HIDE_PRESENCE, 'true']);
      }

      return publish({
        kind: KIND_PRIVACY_PREFERENCES,
        content: '',
        tags,
      });
    },
  });
}

/**
 * Check if a feature should be sent to a peer based on their privacy preferences.
 * Returns true if the feature is allowed.
 */
export function isFeatureAllowed(
  peerPrefs: WhisperPrivacyPreferences,
  feature: 'lastSeen' | 'readReceipts' | 'typingIndicators' | 'profilePhoto' | 'groupsAddMe',
  isContact: boolean,
): boolean {
  const level = peerPrefs[feature] as PrivacyLevel;
  switch (level) {
    case 'everyone': return true;
    case 'contacts': return isContact;
    case 'nobody': return false;
    default: return true;
  }
}
