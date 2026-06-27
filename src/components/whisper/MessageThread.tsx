import { useEffect, useRef, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ArrowLeft, Send, CheckCheck, Check, MoreVertical, Phone, Video } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useAuthor } from '@/hooks/useAuthor';
import { usePresence } from '@/hooks/usePresence';
import {
  useConversationMessages,
  useConversationTyping,
  useConversationReceipts,
} from '@/hooks/useConversations';
import { useSendMessage, useSendReadReceipt, useSendTypingIndicator } from '@/hooks/useWhisperMessages';

import { type WhisperConversation, type WhisperMessage } from '@/lib/whisper/constants';
import { formatTime, formatDateSeparator, isSameDay, formatLastSeen } from '@/lib/whisper/format';

interface MessageThreadProps {
  conversation: WhisperConversation;
  onBack: () => void;
}

export function MessageThread({ conversation, onBack }: MessageThreadProps) {
  const { user } = useCurrentUser();
  const messages = useConversationMessages(conversation.id);
  const typing = useConversationTyping(conversation.id);
  const receipts = useConversationReceipts(conversation.id);
  const { mutateAsync: sendMessage } = useSendMessage();
  const { mutateAsync: sendReadReceipt } = useSendReadReceipt();
  const { mutateAsync: sendTyping } = useSendTypingIndicator();

  const [inputValue, setInputValue] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef(0);

  const isGroup = conversation.isGroup;
  const author = useAuthor(conversation.peerPubkey);
  const presence = usePresence(conversation.peerPubkey);

  const displayName = isGroup
    ? (conversation.group?.name ?? 'Group Chat')
    : (author.data?.metadata?.name ?? author.data?.metadata?.display_name ?? `${conversation.peerPubkey?.slice(0, 8)}...`);

  const profileImage = isGroup ? conversation.group?.picture : author.data?.metadata?.picture;
  const presenceStatus = presence.data?.status;
  const isOnline = presenceStatus === 'online';

  const presenceText = isGroup
    ? `${conversation.group?.members.length ?? 0} members`
    : isOnline
      ? 'online'
      : presence.data?.lastSeen
        ? `last seen ${formatLastSeen(presence.data.lastSeen)}`
        : 'offline';

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  // Send read receipts for unread messages from others
  useEffect(() => {
    if (!user || messages.length === 0) return;

    const unreadFromOthers = messages.filter(
      (m) => m.senderPubkey !== user.pubkey &&
        !receipts.some((r) => r.type === 'read' && r.messageIds.includes(m.id)),
    );

    if (unreadFromOthers.length > 0) {
      // Batch read receipts — send one per sender
      const bySender = new Map<string, string[]>();
      for (const msg of unreadFromOthers) {
        const existing = bySender.get(msg.senderPubkey) ?? [];
        existing.push(msg.id);
        bySender.set(msg.senderPubkey, existing);
      }

      for (const [senderPubkey, messageIds] of bySender) {
        sendReadReceipt({ messageIds, senderPubkey }).catch((err) =>
          console.warn('Failed to send read receipt', err),
        );
      }
    }
  }, [messages, user, sendReadReceipt, receipts]);

  const handleSend = useCallback(async () => {
    const content = inputValue.trim();
    if (!content || !user) return;

    setInputValue('');

    // Fire typing: false indicator (non-blocking — don't wait for it)
    if (isGroup) {
      sendTyping({
        groupId: conversation.groupId,
        groupMembers: conversation.group?.members,
        isTyping: false,
      }).catch(() => {});
    } else {
      sendTyping({
        recipientPubkey: conversation.peerPubkey,
        isTyping: false,
      }).catch(() => {});
    }

    // Clear the typing timeout so it doesn't fire after we send
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }

    // Send the actual message
    try {
      if (isGroup) {
        await sendMessage({
          content,
          groupId: conversation.groupId,
          groupMembers: conversation.group?.members,
        });
      } else {
        await sendMessage({
          content,
          recipientPubkey: conversation.peerPubkey,
        });
      }
    } catch (err) {
      console.error('Failed to send message', err);
      // Restore the text so the user doesn't lose their message
      setInputValue(content);
    }
  }, [inputValue, user, isGroup, conversation, sendMessage, sendTyping]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputValue(e.target.value);

    // Send typing indicator (debounced — send every 4 seconds while typing)
    const now = Date.now();
    if (now - lastTypingSentRef.current > 4000) {
      lastTypingSentRef.current = now;
      if (isGroup) {
        sendTyping({
          groupId: conversation.groupId,
          groupMembers: conversation.group?.members,
          isTyping: true,
        }).catch(() => {});
      } else {
        sendTyping({
          recipientPubkey: conversation.peerPubkey,
          isTyping: true,
        }).catch(() => {});
      }
    }

    // Clear typing timeout
    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = setTimeout(() => {
      // Stop typing indicator after 3 seconds of no input
      if (isGroup) {
        sendTyping({
          groupId: conversation.groupId,
          groupMembers: conversation.group?.members,
          isTyping: false,
        }).catch(() => {});
      } else {
        sendTyping({
          recipientPubkey: conversation.peerPubkey,
          isTyping: false,
        }).catch(() => {});
      }
    }, 3000);
  }, [sendTyping, isGroup, conversation]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Get receipt status for a message
  const getMessageStatus = (msg: WhisperMessage): 'sent' | 'delivered' | 'read' | undefined => {
    if (msg.senderPubkey !== user?.pubkey) return undefined;
    const isRead = receipts.some((r) => r.type === 'read' && r.messageIds.includes(msg.id));
    if (isRead) return 'read';
    const isDelivered = receipts.some((r) => r.type === 'delivered' && r.messageIds.includes(msg.id));
    if (isDelivered) return 'delivered';
    return 'sent';
  };

  const activeTypingUsers = typing.filter((t) => t.senderPubkey !== user?.pubkey);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <Button variant="ghost" size="icon" onClick={onBack} className="md:hidden" aria-label="Back">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="relative shrink-0">
          <Avatar className="h-10 w-10">
            <AvatarImage src={profileImage} />
            <AvatarFallback className={cn(
              'text-xs font-medium',
              isGroup
                ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
                : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
            )}>
              {displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!isGroup && isOnline && (
            <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-medium text-sm text-gray-900 dark:text-white truncate">
            {displayName}
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 truncate">
            {activeTypingUsers.length > 0 ? (
              <span className="text-emerald-600 dark:text-emerald-400">
                {activeTypingUsers.length === 1 ? 'typing...' : `${activeTypingUsers.length} people typing...`}
              </span>
            ) : presenceText}
          </p>
        </div>
        <Button variant="ghost" size="icon" aria-label="Call" className="hidden sm:flex">
          <Phone className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="Video call" className="hidden sm:flex">
          <Video className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="icon" aria-label="More options">
          <MoreVertical className="w-5 h-5" />
        </Button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden bg-[#efeae2] dark:bg-gray-950 relative">
        {/* Subtle wallpaper pattern */}
        <div
          className="absolute inset-0 opacity-[0.03] dark:opacity-[0.02] pointer-events-none"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M30 30c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10zm10 0c0-5.523-4.477-10-10-10s-10 4.477-10 10 4.477 10 10 10 10-4.477 10-10z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
          }}
        />
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="px-4 py-4 space-y-1 relative">
            {messages.length === 0 ? (
              <div className="flex items-center justify-center min-h-[200px]">
                <div className="text-center max-w-xs">
                  <div className="px-4 py-3 rounded-2xl bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm rounded-lg shadow-sm">
                    <p className="text-sm text-gray-600 dark:text-gray-400">
                      No messages yet. Say hello! 👋
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {messages.map((msg, i) => {
                  const prevMsg = messages[i - 1];
                  const showDateSeparator = !prevMsg || !isSameDay(prevMsg.createdAt, msg.createdAt);
                  const isOwn = msg.senderPubkey === user?.pubkey;
                  const showAvatar = !isOwn && isGroup && (!prevMsg || prevMsg.senderPubkey !== msg.senderPubkey);
                  const status = getMessageStatus(msg);

                  return (
                    <div key={msg.id}>
                      {showDateSeparator && (
                        <div className="flex justify-center my-4">
                          <span className="px-3 py-1 rounded-full bg-white/80 dark:bg-gray-800/80 backdrop-blur-sm text-xs text-gray-500 dark:text-gray-400 shadow-sm">
                            {formatDateSeparator(msg.createdAt)}
                          </span>
                        </div>
                      )}
                      <MessageBubble
                        message={msg}
                        isOwn={isOwn}
                        showAvatar={showAvatar}
                        isGroup={isGroup}
                        status={status}
                      />
                    </div>
                  );
                })}
                {/* Typing indicator bubble */}
                {activeTypingUsers.length > 0 && (
                  <div className="flex justify-start mt-1">
                    <div className="px-4 py-2.5 rounded-2xl bg-white dark:bg-gray-800 shadow-sm rounded-bl-sm">
                      <div className="flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                        <span className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Input */}
      <div className="px-4 py-3 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-end gap-2">
          <Textarea
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="min-h-[40px] max-h-32 resize-none rounded-2xl bg-gray-100 dark:bg-gray-800 border-0 focus-visible:ring-1 focus-visible:ring-emerald-500"
            rows={1}
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!inputValue.trim()}
            className="rounded-full bg-emerald-600 hover:bg-emerald-700 shrink-0"
            aria-label="Send message"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  isOwn,
  showAvatar,
  isGroup,
  status,
}: {
  message: WhisperMessage;
  isOwn: boolean;
  showAvatar: boolean;
  isGroup: boolean;
  status?: 'sent' | 'delivered' | 'read';
}) {
  const author = useAuthor(message.senderPubkey);
  const senderName = author.data?.metadata?.name ?? author.data?.metadata?.display_name ?? `${message.senderPubkey.slice(0, 8)}...`;

  return (
    <div className={cn('flex items-end gap-2 mt-1', isOwn ? 'justify-end' : 'justify-start')}>
      {!isOwn && isGroup && (
        <div className="w-8 shrink-0">
          {showAvatar && (
            <Avatar className="w-8 h-8">
              <AvatarImage src={author.data?.metadata?.picture} />
              <AvatarFallback className="text-[10px] bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300">
                {senderName.slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          )}
        </div>
      )}
      <div
        className={cn(
          'max-w-[75%] px-3 py-2 rounded-2xl shadow-sm',
          isOwn
            ? 'bg-emerald-500 text-white rounded-br-sm'
            : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white rounded-bl-sm',
        )}
      >
        {!isOwn && isGroup && showAvatar && (
          <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400 mb-0.5">
            {senderName}
          </p>
        )}
        <p className="text-sm whitespace-pre-wrap break-words">
          {message.content}
        </p>
        <div className={cn('flex items-center gap-1 mt-0.5 justify-end', isOwn ? 'text-emerald-100' : 'text-gray-400')}>
          <span className="text-[10px]">
            {formatTime(message.createdAt)}
          </span>
          {isOwn && status && (
            <span className="ml-0.5">
              {status === 'read' ? (
                <CheckCheck className="w-3.5 h-3.5 text-sky-200" />
              ) : status === 'delivered' ? (
                <CheckCheck className="w-3.5 h-3.5" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
