/**
 * Conversation orchestrator hook.
 * Combines messages, receipts, typing indicators, group metadata,
 * and conversation settings into a unified conversation list state.
 *
 * This is the primary data hook used by the chat UI.
 */
import { useMemo } from 'react';

import { useCurrentUser } from './useCurrentUser';
import { useUnwrappedMessages } from './useWhisperMessages';
import { useConversationSettings } from './useConversationSettings';

import {
  parseGroupFromRumor,
  type WhisperConversation,
  type WhisperMessage,
  type WhisperGroup,
  type NostrEvent,
} from '@/lib/whisper/constants';

export function useConversations() {
  const { user } = useCurrentUser();
  const { data, isLoading, refetch } = useUnwrappedMessages();
  const { data: settingsMap } = useConversationSettings();

  return useMemo(() => {
    if (!user || !data) {
      return {
        conversations: [] as WhisperConversation[],
        allMessages: [] as WhisperMessage[],
        receipts: data?.receipts ?? [],
        typing: data?.typing ?? [],
        groups: {} as Record<string, WhisperGroup>,
        isLoading,
        refetch,
      };
    }

    const groups: Record<string, WhisperGroup> = {};

    // Process group metadata rumors
    for (const rumor of data.groupMetadata) {
      const parsed = parseGroupFromRumor(rumor);
      if (!parsed.id) continue;

      const existing = groups[parsed.id];
      if (!existing || (parsed.updatedAt ?? 0) >= existing.updatedAt) {
        // For add_member/remove_member, merge with existing
        if (existing && rumor.tags.find(([n]) => n === 'group_action')?.[1] !== 'create') {
          groups[parsed.id] = {
            ...existing,
            members: parsed.members ?? existing.members,
            admins: parsed.admins ?? existing.admins,
            name: parsed.name ?? existing.name,
            about: parsed.about ?? existing.about,
            picture: parsed.picture ?? existing.picture,
            updatedAt: parsed.updatedAt ?? existing.updatedAt,
          };
        } else {
          groups[parsed.id] = parsed as WhisperGroup;
        }
      }
    }

    // Group messages by conversation
    const conversationMap = new Map<string, WhisperConversation>();

    for (const msg of data.messages) {
      const convId = msg.conversationId;
      let conv = conversationMap.get(convId);

      if (!conv) {
        // Determine if this is a group conversation
        const group = groups[msg.groupId ?? ''];
        const isGroup = msg.isGroup || !!group;

        conv = {
          id: convId,
          isGroup,
          groupId: msg.groupId,
          peerPubkey: isGroup ? undefined : (msg.senderPubkey === user.pubkey
            ? msg.tags.find(([n]) => n === 'p')?.[1] ?? ''
            : msg.senderPubkey),
          lastMessage: msg,
          lastMessageTime: msg.createdAt,
          unreadCount: 0,
          settings: settingsMap?.get(convId),
          group,
        };
      }

      // Update last message if this one is newer
      if (msg.createdAt > conv.lastMessageTime) {
        conv.lastMessage = msg;
        conv.lastMessageTime = msg.createdAt;
      }

      // Count unread messages (messages from others that we haven't read)
      // For simplicity, count messages from others as unread
      // (In a full implementation, we'd track which messages have read receipts)
      if (msg.senderPubkey !== user.pubkey) {
        const isRead = data.receipts.some(
          (r) => r.type === 'read' && r.messageIds.includes(msg.id),
        );
        if (!isRead) {
          conv.unreadCount++;
        }
      }

      conversationMap.set(convId, conv);
    }

    // Convert to sorted array
    let conversations = Array.from(conversationMap.values());

    // Sort: pinned first (by pin_order), then by last message time
    conversations.sort((a, b) => {
      const aPinned = a.settings?.pinned ?? false;
      const bPinned = b.settings?.pinned ?? false;

      if (aPinned && !bPinned) return -1;
      if (!aPinned && bPinned) return 1;

      if (aPinned && bPinned) {
        return (a.settings?.pinOrder ?? 0) - (b.settings?.pinOrder ?? 0);
      }

      return b.lastMessageTime - a.lastMessageTime;
    });

    // Filter out archived conversations from the main list
    conversations = conversations.filter((c) => !c.settings?.archived);

    return {
      conversations,
      allMessages: data.messages,
      receipts: data.receipts,
      typing: data.typing,
      groups,
      isLoading,
      refetch,
    };
  }, [user, data, settingsMap, isLoading, refetch]);
}

/**
 * Get all messages for a specific conversation.
 */
export function useConversationMessages(conversationId: string | undefined) {
  const { allMessages } = useConversations();

  return useMemo(() => {
    if (!conversationId) return [];
    return allMessages
      .filter((m) => m.conversationId === conversationId)
      .sort((a, b) => a.createdAt - b.createdAt);
  }, [allMessages, conversationId]);
}

/**
 * Get typing indicators for a specific conversation.
 */
export function useConversationTyping(conversationId: string | undefined) {
  const { typing } = useConversations();

  return useMemo(() => {
    if (!conversationId) return [];
    const now = Date.now() / 1000;
    // Filter typing indicators from the last 5 seconds
    return typing.filter(
      (t) => t.conversationId === conversationId && t.isTyping && now - t.timestamp < 5,
    );
  }, [typing, conversationId]);
}

/**
 * Get all receipts for a specific conversation.
 */
export function useConversationReceipts(conversationId: string | undefined) {
  const { receipts } = useConversations();

  return useMemo(() => {
    if (!conversationId) return [];
    return receipts.filter((r) => r.conversationId === conversationId);
  }, [receipts, conversationId]);
}
