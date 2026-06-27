/**
 * Whisper Relay protocol constants and types.
 * Implements WIP-00 through WIP-08 from https://github.com/Denver-1st/mprotocol
 */

// ─── Event Kinds ──────────────────────────────────────────────

/** NIP-17 chat message (rumor inside gift wrap) */
export const KIND_CHAT_MESSAGE = 14;

/** NIP-59 seal */
export const KIND_SEAL = 13;

/** NIP-59 gift wrap */
export const KIND_GIFT_WRAP = 1059;

/** NIP-59 ephemeral gift wrap (not stored by relays) */
export const KIND_EPHEMERAL_GIFT_WRAP = 21059;

/** WIP-01: Read receipt rumor (gift-wrapped) */
export const KIND_READ_RECEIPT = 1271;

/** WIP-02: Delivery receipt rumor (gift-wrapped) */
export const KIND_DELIVERY_RECEIPT = 7753;

/** WIP-04: Messaging presence (signed, replaceable) */
export const KIND_PRESENCE = 14569;

/** NIP-17: DM relay list (replaceable) */
export const KIND_DM_RELAY_LIST = 10050;

/** WIP-06: Conversation settings (signed, addressable) */
export const KIND_CONVERSATION_SETTINGS = 33381;

/** WIP-07: Privacy preferences (signed, addressable) */
export const KIND_PRIVACY_PREFERENCES = 35281;

/** WIP-08: Messaging contacts list (signed, addressable) */
export const KIND_CONTACTS_LIST = 36987;

// ─── Tag Names ────────────────────────────────────────────────

export const TAG_GROUP = 'group';
export const TAG_GROUP_ACTION = 'group_action';
export const TAG_GROUP_NAME = 'group_name';
export const TAG_GROUP_ABOUT = 'group_about';
export const TAG_GROUP_PICTURE = 'group_picture';
export const TAG_GROUP_ADMINS = 'group_admins';

export const TAG_TYPING = 'typing';
export const TAG_READ_AT = 'read_at';
export const TAG_DELIVERED_AT = 'delivered_at';

export const TAG_STATUS = 'status';
export const TAG_LAST_SEEN = 'last_seen';
export const TAG_AVAILABILITY = 'availability';
export const TAG_EXPIRATION = 'expiration';

export const TAG_MUTED = 'muted';
export const TAG_MUTE_DURATION = 'mute_duration';
export const TAG_PINNED = 'pinned';
export const TAG_PIN_ORDER = 'pin_order';
export const TAG_ARCHIVED = 'archived';
export const TAG_WALLPAPER = 'wallpaper';

export const TAG_HIDE_PRESENCE = 'hide_presence';
export const TAG_GROUPS_ADD_ME = 'groups_add_me';

// ─── Enums ────────────────────────────────────────────────────

export type GroupAction = 'create' | 'update' | 'add_member' | 'remove_member';

export type PresenceStatus = 'online' | 'offline' | 'away';

export type PrivacyLevel = 'everyone' | 'contacts' | 'nobody';

// ─── Domain Types ─────────────────────────────────────────────

import type { NostrEvent } from '@nostrify/nostrify';

/** A decrypted rumor from inside a gift wrap. */
export interface WhisperRumor extends NostrEvent {
  // NostrEvent already has id, pubkey, created_at, kind, tags, content, sig
  // For rumors, sig is empty string and id is computed but not signed
}

/** A decrypted direct message. */
export interface WhisperMessage {
  id: string;          // rumor id
  senderPubkey: string;
  content: string;
  createdAt: number;
  tags: string[][];
  conversationId: string;  // peer pubkey for 1:1, group UUID for groups
  isGroup: boolean;
  groupId?: string;
}

/** A read or delivery receipt. */
export interface WhisperReceipt {
  type: 'read' | 'delivered';
  messageIds: string[];   // rumor IDs referenced
  senderPubkey: string;   // who sent the receipt (the recipient of the original message)
  timestamp: number;
  conversationId: string;
}

/** A typing indicator. */
export interface WhisperTyping {
  senderPubkey: string;
  isTyping: boolean;
  conversationId: string;
  timestamp: number;
}

/** Presence info for a user. */
export interface WhisperPresence {
  pubkey: string;
  status: PresenceStatus;
  lastSeen?: number;
  availability?: string;
  customMessage?: string;
  expiration?: number;
  createdAt: number;
}

/** Conversation settings for a single conversation. */
export interface WhisperConversationSettings {
  conversationId: string;
  muted: boolean;
  muteDuration?: number;
  pinned: boolean;
  pinOrder: number;
  archived: boolean;
  wallpaper?: string;
  peerPubkey?: string;
}

/** Privacy preferences for the current user. */
export interface WhisperPrivacyPreferences {
  lastSeen: PrivacyLevel;
  readReceipts: PrivacyLevel;
  typingIndicators: PrivacyLevel;
  profilePhoto: PrivacyLevel;
  hidePresence: boolean;
  groupsAddMe: PrivacyLevel;
}

/** A contact in the messaging address book. */
export interface WhisperContact {
  pubkey: string;
  relay?: string;
  petname?: string;
}

/** A group chat. */
export interface WhisperGroup {
  id: string;          // group UUID
  name?: string;
  about?: string;
  picture?: string;
  members: string[];   // all member pubkeys
  admins: string[];    // admin pubkeys (includes creator)
  creator: string;
  createdAt: number;
  updatedAt: number;
}

/** A conversation in the chat list. */
export interface WhisperConversation {
  id: string;             // peer pubkey or group UUID
  isGroup: boolean;
  groupId?: string;
  peerPubkey?: string;
  lastMessage?: WhisperMessage;
  lastMessageTime: number;
  unreadCount: number;
  settings?: WhisperConversationSettings;
  group?: WhisperGroup;
}

// ─── Defaults ─────────────────────────────────────────────────

export const DEFAULT_PRIVACY_PREFERENCES: WhisperPrivacyPreferences = {
  lastSeen: 'everyone',
  readReceipts: 'everyone',
  typingIndicators: 'everyone',
  profilePhoto: 'everyone',
  hidePresence: false,
  groupsAddMe: 'everyone',
};

export const DEFAULT_CONVERSATION_SETTINGS: Omit<WhisperConversationSettings, 'conversationId'> = {
  muted: false,
  pinned: false,
  pinOrder: 0,
  archived: false,
};

// ─── Helper Functions ─────────────────────────────────────────

/** Generate a random group UUID. */
export function generateGroupId(): string {
  return crypto.randomUUID();
}

/** Get the conversation ID for a 1:1 chat with a peer. */
export function getDirectConversationId(peerPubkey: string): string {
  return peerPubkey;
}

/** Get the conversation ID for a group chat. */
export function getGroupConversationId(groupId: string): string {
  return groupId;
}

/** Extract all p-tag pubkeys from an event (excluding the author). */
export function getPTags(event: NostrEvent): string[] {
  return event.tags
    .filter(([n]) => n === 'p')
    .map(([, pubkey]) => pubkey);
}

/** Get the first tag value for a given tag name. */
export function getTagValue(event: NostrEvent, tagName: string): string | undefined {
  return event.tags.find(([n]) => n === tagName)?.[1];
}

/** Get all tag values for a given tag name. */
export function getTagValues(event: NostrEvent, tagName: string): string[] {
  return event.tags
    .filter(([n]) => n === tagName)
    .map(([, v]) => v);
}

/** Check if an event is a group metadata rumor (has group_action tag). */
export function isGroupMetadataRumor(rumor: NostrEvent): boolean {
  return rumor.kind === KIND_CHAT_MESSAGE && getTagValue(rumor, TAG_GROUP_ACTION) !== undefined;
}

/** Check if an event is a typing indicator rumor (has typing tag). */
export function isTypingRumor(rumor: NostrEvent): boolean {
  return rumor.kind === KIND_CHAT_MESSAGE && getTagValue(rumor, TAG_TYPING) !== undefined;
}

/** Check if a rumor is a regular chat message (not metadata or typing). */
export function isChatMessageRumor(rumor: NostrEvent): boolean {
  return rumor.kind === KIND_CHAT_MESSAGE
    && getTagValue(rumor, TAG_GROUP_ACTION) === undefined
    && getTagValue(rumor, TAG_TYPING) === undefined;
}

/** Parse privacy preferences from a kind 35281 event. */
export function parsePrivacyPreferences(event: NostrEvent | undefined): WhisperPrivacyPreferences {
  if (!event) return { ...DEFAULT_PRIVACY_PREFERENCES };
  return {
    lastSeen: (getTagValue(event, 'last_seen') as PrivacyLevel) ?? 'everyone',
    readReceipts: (getTagValue(event, 'read_receipts') as PrivacyLevel) ?? 'everyone',
    typingIndicators: (getTagValue(event, 'typing_indicators') as PrivacyLevel) ?? 'everyone',
    profilePhoto: (getTagValue(event, 'profile_photo') as PrivacyLevel) ?? 'everyone',
    hidePresence: getTagValue(event, TAG_HIDE_PRESENCE) === 'true',
    groupsAddMe: (getTagValue(event, TAG_GROUPS_ADD_ME) as PrivacyLevel) ?? 'everyone',
  };
}

/** Parse conversation settings from a kind 33381 event. */
export function parseConversationSettings(event: NostrEvent): WhisperConversationSettings {
  return {
    conversationId: getTagValue(event, 'd') ?? '',
    muted: getTagValue(event, TAG_MUTED) === 'true',
    muteDuration: getTagValue(event, TAG_MUTE_DURATION) ? Number(getTagValue(event, TAG_MUTE_DURATION)) : undefined,
    pinned: getTagValue(event, TAG_PINNED) === 'true',
    pinOrder: getTagValue(event, TAG_PIN_ORDER) ? Number(getTagValue(event, TAG_PIN_ORDER)) : 0,
    archived: getTagValue(event, TAG_ARCHIVED) === 'true',
    wallpaper: getTagValue(event, TAG_WALLPAPER),
    peerPubkey: getTagValue(event, 'p')?.[1],
  };
}

/** Parse contacts from a kind 36987 event. */
export function parseContacts(event: NostrEvent | undefined): WhisperContact[] {
  if (!event) return [];
  return event.tags
    .filter(([n]) => n === 'p')
    .map(([, pubkey, relay, petname]) => ({ pubkey, relay, petname }));
}

/** Parse a group from a kind 14 rumor with group_action tag. */
export function parseGroupFromRumor(rumor: NostrEvent): Partial<WhisperGroup> & { id: string; creator: string } {
  const groupId = getTagValue(rumor, TAG_GROUP) ?? '';
  const members = getPTags(rumor);
  const adminTags = getTagValues(rumor, TAG_GROUP_ADMINS);
  return {
    id: groupId,
    name: getTagValue(rumor, TAG_GROUP_NAME),
    about: getTagValue(rumor, TAG_GROUP_ABOUT),
    picture: getTagValue(rumor, TAG_GROUP_PICTURE),
    members,
    admins: adminTags.length > 0 ? adminTags : [rumor.pubkey],
    creator: rumor.pubkey,
    createdAt: rumor.created_at,
    updatedAt: rumor.created_at,
  };
}

/** Parse presence from a kind 14569 event. */
export function parsePresence(event: NostrEvent | undefined): WhisperPresence | undefined {
  if (!event) return undefined;
  return {
    pubkey: event.pubkey,
    status: (getTagValue(event, TAG_STATUS) as PresenceStatus) ?? 'offline',
    lastSeen: getTagValue(event, TAG_LAST_SEEN) ? Number(getTagValue(event, TAG_LAST_SEEN)) : undefined,
    availability: getTagValue(event, TAG_AVAILABILITY),
    customMessage: event.content || undefined,
    expiration: getTagValue(event, TAG_EXPIRATION) ? Number(getTagValue(event, TAG_EXPIRATION)) : undefined,
    createdAt: event.created_at,
  };
}

/** Parse a typing indicator from a kind 14 rumor. */
export function parseTypingRumor(rumor: NostrEvent): WhisperTyping {
  return {
    senderPubkey: rumor.pubkey,
    isTyping: getTagValue(rumor, TAG_TYPING) === 'true',
    conversationId: getTagValue(rumor, TAG_GROUP) ?? getPTags(rumor)[0] ?? '',
    timestamp: rumor.created_at,
  };
}

/** Parse a receipt (read or delivery) from a rumor. */
export function parseReceipt(rumor: NostrEvent, type: 'read' | 'delivered'): WhisperReceipt {
  const messageIds = getTagValues(rumor, 'e');
  const peerPubkey = getTagValue(rumor, 'p') ?? '';
  const timestampTag = type === 'read' ? TAG_READ_AT : TAG_DELIVERED_AT;
  const timestamp = getTagValue(rumor, timestampTag) ? Number(getTagValue(rumor, timestampTag)) : rumor.created_at;
  return {
    type,
    messageIds,
    senderPubkey: rumor.pubkey,
    timestamp,
    conversationId: peerPubkey,
  };
}
