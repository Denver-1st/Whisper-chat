import { useState, useMemo } from 'react';
import { useSeoMeta } from '@unhead/react';
import { cn } from '@/lib/utils';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useConversations } from '@/hooks/useConversations';
import { LoginArea } from '@/components/auth/LoginArea';
import { ConversationList } from '@/components/whisper/ConversationList';
import { MessageThread } from '@/components/whisper/MessageThread';
import { NewChatDialog } from '@/components/whisper/NewChatDialog';
import { SettingsDialog } from '@/components/whisper/SettingsDialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { MessageCircle, Settings, PenSquare } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { WhisperConversation } from '@/lib/whisper/constants';

export default function ChatPage() {
  const { user } = useCurrentUser();
  const { conversations, isLoading } = useConversations();
  const [selectedConversationId, setSelectedConversationId] = useState<string | undefined>();
  const [showNewChat, setShowNewChat] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  useSeoMeta({
    title: 'Whisper Chat — Nostr Instant Messaging',
    description: 'End-to-end encrypted, Nostr-native instant messaging. Whisper Relay protocol.',
  });

  // Not logged in state
  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 dark:from-gray-950 dark:via-gray-900 dark:to-emerald-950">
        <div className="text-center max-w-md mx-auto px-6">
          <div className="mb-8 flex justify-center">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-xl shadow-emerald-500/20">
              <MessageCircle className="w-10 h-10 text-white" />
            </div>
          </div>
          <h1 className="text-4xl font-bold mb-3 text-gray-900 dark:text-white">
            Whisper Chat
          </h1>
          <p className="text-lg text-gray-600 dark:text-gray-400 mb-8">
            End-to-end encrypted, Nostr-native instant messaging.
            Your keys, your messages, your privacy.
          </p>
          <div className="flex justify-center">
            <LoginArea className="w-full max-w-xs" />
          </div>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-8">
            Vibed with{' '}
            <a
              href="https://shakespeare.diy"
              target="_blank"
              rel="noopener noreferrer"
              className="text-emerald-600 dark:text-emerald-400 hover:underline"
            >
              Shakespeare
            </a>
          </p>
        </div>
      </div>
    );
  }

  const selectedConversation = useMemo(() => {
    // First try to find it in the conversations list (existing conversation with messages)
    const existing = conversations.find((c) => c.id === selectedConversationId);
    if (existing) return existing;

    // If not found, create a draft conversation so the message thread can render
    // even when there are no messages yet (e.g., just started a new chat with a contact)
    if (selectedConversationId && user) {
      // Check if this looks like a group ID (UUID format) vs a pubkey (64 hex chars)
      const isGroup = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(selectedConversationId);
      return {
        id: selectedConversationId,
        isGroup,
        groupId: isGroup ? selectedConversationId : undefined,
        peerPubkey: isGroup ? undefined : selectedConversationId,
        lastMessage: undefined,
        lastMessageTime: 0,
        unreadCount: 0,
      } satisfies WhisperConversation;
    }

    return undefined;
  }, [conversations, selectedConversationId, user]);

  return (
    <div className="flex flex-col h-screen bg-gray-50 dark:bg-gray-950">
      {/* Top Bar */}
      <header className="flex items-center justify-between px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <div className="flex items-center gap-3">
          <Link to="/" className="flex items-center gap-2 hover:opacity-80 transition-opacity">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center">
              <MessageCircle className="w-5 h-5 text-white" />
            </div>
            <span className="font-bold text-lg text-gray-900 dark:text-white">Whisper</span>
          </Link>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setShowSettings(true)}
            aria-label="Settings"
          >
            <Settings className="w-5 h-5" />
          </Button>
          <div className="flex items-center gap-2">
            <Avatar className="w-8 h-8">
              <AvatarImage src="" />
              <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs">
                {user.pubkey.slice(0, 4).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="hidden sm:block">
              <LoginArea className="max-w-[160px]" />
            </div>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Conversation List — hidden on mobile when a conversation is selected */}
        <aside
          className={cn(
            'w-full md:w-80 lg:w-96 border-r border-gray-200 dark:border-gray-800 flex flex-col bg-white dark:bg-gray-900',
            selectedConversationId && 'hidden md:flex',
          )}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 dark:border-gray-800">
            <h2 className="font-semibold text-gray-900 dark:text-white">Chats</h2>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => setShowNewChat(true)}
              aria-label="New chat"
              className="text-emerald-600 dark:text-emerald-400"
            >
              <PenSquare className="w-5 h-5" />
            </Button>
          </div>
          <ConversationList
            conversations={conversations}
            isLoading={isLoading}
            selectedId={selectedConversationId}
            onSelect={setSelectedConversationId}
          />
        </aside>

        {/* Message Thread — hidden on mobile when no conversation is selected */}
        <main
          className={cn(
            'flex-1 flex flex-col bg-gray-50 dark:bg-gray-950',
            !selectedConversationId && 'hidden md:flex',
          )}
        >
          {selectedConversation ? (
            <MessageThread conversation={selectedConversation} onBack={() => setSelectedConversationId(undefined)} />
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center max-w-sm">
                <div className="w-16 h-16 rounded-2xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="w-8 h-8 text-gray-400" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 dark:text-white mb-1">
                  Select a conversation
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Choose a chat from the list or start a new conversation.
                </p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() => setShowNewChat(true)}
                >
                  <PenSquare className="w-4 h-4 mr-2" />
                  New Chat
                </Button>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Dialogs */}
      <NewChatDialog
        open={showNewChat}
        onOpenChange={setShowNewChat}
        onConversationSelected={setSelectedConversationId}
      />
      <SettingsDialog open={showSettings} onOpenChange={setShowSettings} />
    </div>
  );
}
