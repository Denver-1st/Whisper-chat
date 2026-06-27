/**
 * WIP-05: Private Group Metadata.
 * Group creation, member management, name, picture, and description.
 *
 * Group metadata is sent as kind 14 rumors with group_action tags,
 * sealed and gift-wrapped to all members via NIP-59.
 */
import { useMutation } from '@tanstack/react-query';
import { useNostr } from '@nostrify/react';

import { useCurrentUser } from './useCurrentUser';

import {
  createRumor,
  giftWrapToMany,
} from '@/lib/whisper/giftwrap';
import {
  KIND_CHAT_MESSAGE,
  TAG_GROUP,
  TAG_GROUP_ACTION,
  TAG_GROUP_NAME,
  TAG_GROUP_ABOUT,
  TAG_GROUP_PICTURE,
  TAG_GROUP_ADMINS,
  type WhisperGroup,
  type GroupAction,
  generateGroupId,
} from '@/lib/whisper/constants';

import { publishGiftWraps } from './useWhisperMessages';

type NostrPool = ReturnType<typeof useNostr>['nostr'];

/** Create a new group chat. */
export function useCreateGroup() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      name,
      about,
      picture,
      members,
      admins = [],
    }: {
      name: string;
      about?: string;
      picture?: string;
      members: string[];
      admins?: string[];
    }) => {
      if (!user) throw new Error('User not logged in');

      const groupId = generateGroupId();
      const allMembers = [...new Set([...members, user.pubkey])];
      const allAdmins = [...new Set([...admins, user.pubkey])];

      const tags: string[][] = [
        [TAG_GROUP, groupId],
        [TAG_GROUP_ACTION, 'create' satisfies GroupAction],
        [TAG_GROUP_NAME, name],
      ];

      if (about) tags.push([TAG_GROUP_ABOUT, about]);
      if (picture) tags.push([TAG_GROUP_PICTURE, picture]);

      for (const admin of allAdmins) {
        tags.push([TAG_GROUP_ADMINS, admin]);
      }

      for (const member of allMembers) {
        tags.push(['p', member]);
      }

      const rumor = createRumor(
        { kind: KIND_CHAT_MESSAGE, content: '', tags },
        user.pubkey,
      );

      // Gift-wrap to all members (including self)
      const wraps = giftWrapToMany(rumor, allMembers);

      // Publish to each member's DM relays
      await publishGiftWraps(nostr as NostrPool, wraps, allMembers);

      const group: WhisperGroup = {
        id: groupId,
        name,
        about,
        picture,
        members: allMembers,
        admins: allAdmins,
        creator: user.pubkey,
        createdAt: rumor.created_at,
        updatedAt: rumor.created_at,
      };

      return group;
    },
  });
}

/** Update group metadata (name, about, picture). */
export function useUpdateGroup() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      group,
      name,
      about,
      picture,
    }: {
      group: WhisperGroup;
      name?: string;
      about?: string;
      picture?: string;
    }) => {
      if (!user) throw new Error('User not logged in');

      // Only admins can update
      if (!group.admins.includes(user.pubkey)) {
        throw new Error('Only admins can update group metadata');
      }

      const tags: string[][] = [
        [TAG_GROUP, group.id],
        [TAG_GROUP_ACTION, 'update' satisfies GroupAction],
      ];

      if (name) tags.push([TAG_GROUP_NAME, name]);
      if (about) tags.push([TAG_GROUP_ABOUT, about]);
      if (picture) tags.push([TAG_GROUP_PICTURE, picture]);

      for (const admin of group.admins) {
        tags.push([TAG_GROUP_ADMINS, admin]);
      }

      for (const member of group.members) {
        tags.push(['p', member]);
      }

      const rumor = createRumor(
        { kind: KIND_CHAT_MESSAGE, content: '', tags },
        user.pubkey,
      );

      const wraps = giftWrapToMany(rumor, group.members);
      await publishGiftWraps(nostr as NostrPool, wraps, group.members);

      return rumor;
    },
  });
}

/** Add a member to a group. */
export function useAddGroupMember() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      group,
      newMemberPubkey,
    }: {
      group: WhisperGroup;
      newMemberPubkey: string;
    }) => {
      if (!user) throw new Error('User not logged in');
      if (!group.admins.includes(user.pubkey)) {
        throw new Error('Only admins can add members');
      }

      const updatedMembers = [...new Set([...group.members, newMemberPubkey])];

      const tags: string[][] = [
        [TAG_GROUP, group.id],
        [TAG_GROUP_ACTION, 'add_member' satisfies GroupAction],
      ];

      for (const member of updatedMembers) {
        tags.push(['p', member]);
      }

      const rumor = createRumor(
        { kind: KIND_CHAT_MESSAGE, content: '', tags },
        user.pubkey,
      );

      // Gift-wrap to all members including the new one
      const wraps = giftWrapToMany(rumor, updatedMembers);
      await publishGiftWraps(nostr as NostrPool, wraps, updatedMembers);

      return rumor;
    },
  });
}

/** Remove a member from a group. */
export function useRemoveGroupMember() {
  const { nostr } = useNostr();
  const { user } = useCurrentUser();

  return useMutation({
    mutationFn: async ({
      group,
      memberPubkey,
    }: {
      group: WhisperGroup;
      memberPubkey: string;
    }) => {
      if (!user) throw new Error('User not logged in');
      if (!group.admins.includes(user.pubkey)) {
        throw new Error('Only admins can remove members');
      }

      const updatedMembers = group.members.filter((m) => m !== memberPubkey);

      const tags: string[][] = [
        [TAG_GROUP, group.id],
        [TAG_GROUP_ACTION, 'remove_member' satisfies GroupAction],
      ];

      for (const member of updatedMembers) {
        tags.push(['p', member]);
      }

      const rumor = createRumor(
        { kind: KIND_CHAT_MESSAGE, content: '', tags },
        user.pubkey,
      );

      const wraps = giftWrapToMany(rumor, updatedMembers);
      await publishGiftWraps(nostr as NostrPool, wraps, updatedMembers);

      return rumor;
    },
  });
}
