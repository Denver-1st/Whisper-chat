import { useState } from 'react';
import { cn } from '@/lib/utils';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, UserPlus, Users } from 'lucide-react';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useContacts } from '@/hooks/useContacts';
import { useAuthor } from '@/hooks/useAuthor';
import { useAddContact } from '@/hooks/useContacts';
import { useCreateGroup } from '@/hooks/useGroups';
import { nip19 } from 'nostr-tools';

interface NewChatDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConversationSelected?: (conversationId: string) => void;
}

export function NewChatDialog({ open, onOpenChange, onConversationSelected }: NewChatDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New Conversation</DialogTitle>
          <DialogDescription>
            Start a new chat or create a group.
          </DialogDescription>
        </DialogHeader>
        <Tabs defaultValue="contact" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="contact">
              <UserPlus className="w-4 h-4 mr-2" />
              New Chat
            </TabsTrigger>
            <TabsTrigger value="group">
              <Users className="w-4 h-4 mr-2" />
              New Group
            </TabsTrigger>
          </TabsList>
          <TabsContent value="contact">
            <NewDirectChatTab onOpenChange={onOpenChange} onConversationSelected={onConversationSelected} />
          </TabsContent>
          <TabsContent value="group">
            <NewGroupTab onOpenChange={onOpenChange} onConversationSelected={onConversationSelected} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

function NewDirectChatTab({
  onOpenChange,
  onConversationSelected,
}: {
  onOpenChange: (open: boolean) => void;
  onConversationSelected?: (id: string) => void;
}) {
  const { user } = useCurrentUser();
  const { data: contacts, isLoading } = useContacts();
  const { mutateAsync: addContact } = useAddContact();
  const [npubInput, setNpubInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  const handleStartChat = (pubkey: string) => {
    onConversationSelected?.(pubkey);
    onOpenChange(false);
  };

  const handleAddByNpub = async () => {
    setError(null);
    try {
      let value = npubInput.trim();
      // Strip nostr: prefix if present
      if (value.startsWith('nostr:')) value = value.slice(6);

      const decoded = nip19.decode(value);
      if (decoded.type !== 'npub' && decoded.type !== 'nprofile') {
        setError('Please enter a valid npub');
        return;
      }

      const pubkey = decoded.type === 'npub'
        ? decoded.data
        : decoded.data.pubkey;

      if (user && pubkey === user.pubkey) {
        setError("You can't chat with yourself");
        return;
      }

      // Add to contacts (non-blocking — don't block the chat from opening if it fails)
      addContact({ pubkey }).catch((err) => {
        console.warn('Failed to add contact (chat will still open)', err);
      });

      // Start the chat immediately
      handleStartChat(pubkey);
    } catch {
      setError('Invalid npub format');
    }
  };

  return (
    <div className="space-y-4 py-2">
      {/* Add by npub */}
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Start chat with npub
        </label>
        <div className="flex gap-2">
          <Input
            value={npubInput}
            onChange={(e) => setNpubInput(e.target.value)}
            placeholder="npub1..."
            onKeyDown={(e) => e.key === 'Enter' && handleAddByNpub()}
          />
          <Button onClick={handleAddByNpub} disabled={!npubInput.trim()}>
            Chat
          </Button>
        </div>
        {error && <p className="text-xs text-red-500">{error}</p>}
      </div>

      {/* Contacts list */}
      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Your Contacts
        </p>
        <ScrollArea className="h-[240px] -mx-2">
          <div className="px-2 space-y-1">
            {isLoading ? (
              <p className="text-sm text-gray-400 text-center py-4">Loading contacts...</p>
            ) : !contacts || contacts.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No contacts yet. Add one by npub above.
              </p>
            ) : (
              contacts.map((contact) => (
                <ContactItem
                  key={contact.pubkey}
                  pubkey={contact.pubkey}
                  petname={contact.petname}
                  onClick={() => handleStartChat(contact.pubkey)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}

function ContactItem({
  pubkey,
  petname,
  onClick,
}: {
  pubkey: string;
  petname?: string;
  onClick: () => void;
}) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const name = petname ?? metadata?.name ?? metadata?.display_name ?? `${pubkey.slice(0, 8)}...`;

  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors text-left"
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={metadata?.picture} />
        <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
        <p className="text-xs text-gray-400 dark:text-gray-500 truncate">
          {metadata?.nip05 ? `✓ ${metadata.nip05}` : `${pubkey.slice(0, 12)}...`}
        </p>
      </div>
    </button>
  );
}

function NewGroupTab({
  onOpenChange,
  onConversationSelected,
}: {
  onOpenChange: (open: boolean) => void;
  onConversationSelected?: (id: string) => void;
}) {
  const { user } = useCurrentUser();
  const { data: contacts } = useContacts();
  const { mutateAsync: createGroup } = useCreateGroup();
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());
  const [isCreating, setIsCreating] = useState(false);

  const toggleMember = (pubkey: string) => {
    setSelectedMembers((prev) => {
      const next = new Set(prev);
      if (next.has(pubkey)) next.delete(pubkey);
      else next.add(pubkey);
      return next;
    });
  };

  const handleCreate = async () => {
    if (!user || !groupName.trim() || selectedMembers.size < 1) return;
    setIsCreating(true);
    try {
      const group = await createGroup({
        name: groupName.trim(),
        members: Array.from(selectedMembers),
      });
      onConversationSelected?.(group.id);
      onOpenChange(false);
    } catch (err) {
      console.error('Failed to create group', err);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4 py-2">
      <div className="space-y-2">
        <label className="text-sm font-medium text-gray-700 dark:text-gray-300">
          Group name
        </label>
        <Input
          value={groupName}
          onChange={(e) => setGroupName(e.target.value)}
          placeholder="Family Chat"
        />
      </div>

      <div>
        <p className="text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-2">
          Select members ({selectedMembers.size} selected)
        </p>
        <ScrollArea className="h-[200px] -mx-2">
          <div className="px-2 space-y-1">
            {(!contacts || contacts.length === 0) ? (
              <p className="text-sm text-gray-400 text-center py-4">
                No contacts available. Add contacts first.
              </p>
            ) : (
              contacts.map((contact) => (
                <SelectableContactItem
                  key={contact.pubkey}
                  pubkey={contact.pubkey}
                  petname={contact.petname}
                  isSelected={selectedMembers.has(contact.pubkey)}
                  onToggle={() => toggleMember(contact.pubkey)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </div>

      <Button
        onClick={handleCreate}
        disabled={!groupName.trim() || selectedMembers.size < 1 || isCreating}
        className="w-full"
      >
        {isCreating ? 'Creating...' : `Create Group (${selectedMembers.size + 1} members)`}
      </Button>
    </div>
  );
}

function SelectableContactItem({
  pubkey,
  petname,
  isSelected,
  onToggle,
}: {
  pubkey: string;
  petname?: string;
  isSelected: boolean;
  onToggle: () => void;
}) {
  const author = useAuthor(pubkey);
  const metadata = author.data?.metadata;
  const name = petname ?? metadata?.name ?? metadata?.display_name ?? `${pubkey.slice(0, 8)}...`;

  return (
    <button
      onClick={onToggle}
      className={cn(
        'w-full flex items-center gap-3 p-2 rounded-lg transition-colors text-left',
        isSelected ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'hover:bg-gray-100 dark:hover:bg-gray-800',
      )}
    >
      <Avatar className="h-10 w-10">
        <AvatarImage src={metadata?.picture} />
        <AvatarFallback className="bg-emerald-100 dark:bg-emerald-900 text-emerald-700 dark:text-emerald-300 text-xs">
          {name.slice(0, 2).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{name}</p>
      </div>
      <div className={cn(
        'w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0',
        isSelected ? 'bg-emerald-500 border-emerald-500' : 'border-gray-300 dark:border-gray-600',
      )}>
        {isSelected && <span className="text-white text-xs">✓</span>}
      </div>
    </button>
  );
}
