/**
 * WIP-08: Contacts List (kind 36987, addressable).
 * Messaging-native address book with petnames.
 */
import { useNostr } from '@nostrify/react';
import { useQuery, useMutation } from '@tanstack/react-query';

import { useCurrentUser } from './useCurrentUser';
import { useNostrPublish } from './useNostrPublish';
import {
  KIND_CONTACTS_LIST,
  parseContacts,
  type WhisperContact,
} from '@/lib/whisper/constants';

/** Fetch the current user's messaging contacts list. */
export function useContacts() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useQuery<WhisperContact[]>({
    queryKey: ['nostr', 'contacts', user?.pubkey ?? ''],
    queryFn: async (c) => {
      if (!user) return [];

      const [event] = await nostr.query(
        [{ kinds: [KIND_CONTACTS_LIST], authors: [user.pubkey], '#d': ['contacts'], limit: 1 }],
        { signal: c.signal },
      );

      return parseContacts(event);
    },
    enabled: !!user,
  });
}

/** Check if a pubkey is in the user's contacts. */
export function useIsContact() {
  const { data: contacts } = useContacts();

  return (pubkey: string): boolean => {
    return contacts?.some((c) => c.pubkey === pubkey) ?? false;
  };
}

/** Update the contacts list. Replaces the entire list. */
export function useUpdateContacts() {
  const { mutateAsync: publish } = useNostrPublish();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async (contacts: WhisperContact[]) => {
      if (!user) throw new Error('User not logged in');

      const tags: string[][] = [['d', 'contacts'], ['title', 'My Contacts']];

      for (const contact of contacts) {
        const pTag: string[] = ['p', contact.pubkey];
        if (contact.relay) pTag.push(contact.relay);
        if (contact.petname) pTag.push(contact.petname);
        tags.push(pTag);
      }

      return publish({
        kind: KIND_CONTACTS_LIST,
        content: '',
        tags,
      });
    },
  });
}

/** Add a single contact. */
export function useAddContact() {
  const { data: contacts } = useContacts();
  const { mutateAsync: updateContacts } = useUpdateContacts();

  return useMutation({
    mutationFn: async (contact: WhisperContact) => {
      const current = contacts ?? [];
      // Don't add duplicates
      if (current.some((c) => c.pubkey === contact.pubkey)) {
        return;
      }
      const updated = [...current, contact];
      await updateContacts(updated);
    },
  });
}

/** Remove a contact by pubkey. */
export function useRemoveContact() {
  const { data: contacts } = useContacts();
  const { mutateAsync: updateContacts } = useUpdateContacts();

  return useMutation({
    mutationFn: async (pubkey: string) => {
      const current = contacts ?? [];
      const updated = current.filter((c) => c.pubkey !== pubkey);
      await updateContacts(updated);
    },
  });
}
