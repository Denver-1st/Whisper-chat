import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CheckCheck, Check, Pin, BellOff, Archive } from 'lucide-react';

import { useAuthor } from '@/hooks/useAuthor';
import { usePresence } from '@/hooks/usePresence';
import { type WhisperConversation } from '@/lib/whisper/constants';
import { formatRelativeTime } from '@/lib/whisper/format';

interface ConversationListProps {
  conversations: WhisperConversation[];
  isLoading: boolean;
  selectedId?: string;
  onSelect: (id: string) => void;
}

export function ConversationList({ conversations, isLoading, selectedId, onSelect }: ConversationListProps) {
  if (isLoading) {
    return (
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-xl">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    );
  }

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <p className="text-sm text-gray-500 dark:text-gray-400 mb-2">
            No conversations yet
          </p>
          <p className="text-xs text-gray-400 dark:text-gray-500">
            Start a new chat to begin messaging
          </p>
        </div>
      </div>
    );
  }

  return (
    <ScrollArea className="flex-1">
      <div className="p-2 space-y-0.5">
        {conversations.map((conv) => (
          <ConversationItem
            key={conv.id}
            conversation={conv}
            isSelected={conv.id === selectedId}
            onClick={() => onSelect(conv.id)}
          />
        ))}
      </div>
    </ScrollArea>
  );
}

function ConversationItem({
  conversation,
  isSelected,
  onClick,
}: {
  conversation: WhisperConversation;
  isSelected: boolean;
  onClick: () => void;
}) {
  // For 1:1 chats, fetch the peer's profile
  const author = useAuthor(conversation.peerPubkey);
  const presence = usePresence(conversation.peerPubkey);

  const isGroup = conversation.isGroup;
  const displayName = isGroup
    ? (conversation.group?.name ?? 'Group Chat')
    : (author.data?.metadata?.name ?? author.data?.metadata?.display_name ?? `${conversation.peerPubkey?.slice(0, 8)}...`);

  const profileImage = isGroup ? conversation.group?.picture : author.data?.metadata?.picture;
  const lastMessage = conversation.lastMessage;

  const isOnline = presence.data?.status === 'online';
  const isMuted = conversation.settings?.muted;
  const isPinned = conversation.settings?.pinned;
  const isArchived = conversation.settings?.archived;

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center gap-3 p-3 rounded-xl transition-colors text-left',
        isSelected
          ? 'bg-emerald-50 dark:bg-emerald-950/40'
          : 'hover:bg-gray-50 dark:hover:bg-gray-800/50',
      )}
    >
      {/* Avatar */}
      <div className="relative shrink-0">
        <Avatar className="h-12 w-12">
          <AvatarImage src={profileImage} />
          <AvatarFallback className={cn(
            'text-sm font-medium',
            isGroup
              ? 'bg-purple-100 dark:bg-purple-900 text-purple-700 dark:text-purple-300'
              : 'bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300',
          )}>
            {displayName.slice(0, 2).toUpperCase()}
          </AvatarFallback>
        </Avatar>
        {!isGroup && isOnline && (
          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
        )}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1 min-w-0">
            <span className="font-medium text-sm text-gray-900 dark:text-white truncate">
              {displayName}
            </span>
            {isPinned && <Pin className="w-3 h-3 text-gray-400 shrink-0" />}
            {isMuted && <BellOff className="w-3 h-3 text-gray-400 shrink-0" />}
            {isArchived && <Archive className="w-3 h-3 text-gray-400 shrink-0" />}
          </div>
          {lastMessage && (
            <span className="text-xs text-gray-400 dark:text-gray-500 shrink-0">
              {formatRelativeTime(lastMessage.createdAt)}
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2 mt-0.5">
          <p className="text-sm text-gray-500 dark:text-gray-400 truncate flex-1">
            {lastMessage ? (
              <>
                {lastMessage.content || (isGroup ? `${lastMessage.senderPubkey.slice(0, 8)}...` : '')}
              </>
            ) : (
              'No messages yet'
            )}
          </p>
          {conversation.unreadCount > 0 && (
            <span className="shrink-0 min-w-[20px] h-5 px-1.5 rounded-full bg-emerald-500 text-white text-xs font-medium flex items-center justify-center">
              {conversation.unreadCount > 99 ? '99+' : conversation.unreadCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
}
