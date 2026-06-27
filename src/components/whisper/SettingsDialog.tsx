import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Shield, Eye, CheckCheck, Keyboard, UserCircle, Users } from 'lucide-react';

import {
  useMyPrivacyPreferences,
  useUpdatePrivacyPreferences,
} from '@/hooks/usePrivacyPreferences';
import { usePublishPresence } from '@/hooks/usePresence';
import {
  type PrivacyLevel,
  DEFAULT_PRIVACY_PREFERENCES,
} from '@/lib/whisper/constants';

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SettingsDialog({ open, onOpenChange }: SettingsDialogProps) {
  const { data: prefs } = useMyPrivacyPreferences();
  const { mutateAsync: updatePrefs } = useUpdatePrivacyPreferences();
  const { mutateAsync: publishPresence } = usePublishPresence();

  const [localPrefs, setLocalPrefs] = useState(DEFAULT_PRIVACY_PREFERENCES);

  useEffect(() => {
    if (prefs) setLocalPrefs(prefs);
  }, [prefs]);

  const handleUpdate = async (updates: Partial<typeof localPrefs>) => {
    const updated = { ...localPrefs, ...updates };
    setLocalPrefs(updated);
    try {
      await updatePrefs(updated);
    } catch (err) {
      console.error('Failed to update privacy preferences', err);
    }
  };

  const privacyOptions: { value: PrivacyLevel; label: string }[] = [
    { value: 'everyone', label: 'Everyone' },
    { value: 'contacts', label: 'Contacts only' },
    { value: 'nobody', label: 'Nobody' },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Manage your privacy and messaging preferences.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="max-h-[55vh] pr-4">
          <div className="space-y-6 py-2">
            {/* Privacy Preferences */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-emerald-600" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Privacy
                </h3>
              </div>

              <PrivacySelect
                icon={<Eye className="w-4 h-4" />}
                label="Last Seen"
                description="Who can see when you were last active"
                value={localPrefs.lastSeen}
                options={privacyOptions}
                onChange={(v) => handleUpdate({ lastSeen: v })}
              />

              <PrivacySelect
                icon={<CheckCheck className="w-4 h-4" />}
                label="Read Receipts"
                description="Who can see when you've read messages"
                value={localPrefs.readReceipts}
                options={privacyOptions}
                onChange={(v) => handleUpdate({ readReceipts: v })}
              />

              <PrivacySelect
                icon={<Keyboard className="w-4 h-4" />}
                label="Typing Indicators"
                description="Who can see when you're typing"
                value={localPrefs.typingIndicators}
                options={privacyOptions}
                onChange={(v) => handleUpdate({ typingIndicators: v })}
              />

              <PrivacySelect
                icon={<UserCircle className="w-4 h-4" />}
                label="Profile Photo"
                description="Who can see your profile photo"
                value={localPrefs.profilePhoto}
                options={privacyOptions}
                onChange={(v) => handleUpdate({ profilePhoto: v })}
              />

              <PrivacySelect
                icon={<Users className="w-4 h-4" />}
                label="Group Invites"
                description="Who can add you to groups"
                value={localPrefs.groupsAddMe}
                options={[
                  { value: 'everyone', label: 'Everyone' },
                  { value: 'contacts', label: 'Contacts only' },
                ]}
                onChange={(v) => handleUpdate({ groupsAddMe: v })}
              />

              {/* Hide presence toggle */}
              <div className="flex items-center justify-between py-2">
                <div className="space-y-0.5 pr-4">
                  <Label className="text-sm font-medium">Hide Presence</Label>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    Don't publish online/offline status
                  </p>
                </div>
                <Switch
                  checked={localPrefs.hidePresence}
                  onCheckedChange={(checked) => handleUpdate({ hidePresence: checked })}
                />
              </div>
            </div>

            {/* Quick Actions */}
            <div className="space-y-3 pt-4 border-t border-gray-200 dark:border-gray-700">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                Quick Actions
              </h3>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => publishPresence({ status: 'online' })}
              >
                <span className="w-2 h-2 rounded-full bg-green-500 mr-2" />
                Set status to Online
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => publishPresence({ status: 'away', availability: 'Away' })}
              >
                <span className="w-2 h-2 rounded-full bg-yellow-500 mr-2" />
                Set status to Away
              </Button>
              <Button
                variant="outline"
                className="w-full justify-start"
                onClick={() => publishPresence({ status: 'offline' })}
              >
                <span className="w-2 h-2 rounded-full bg-gray-400 mr-2" />
                Set status to Offline
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}

function PrivacySelect({
  icon,
  label,
  description,
  value,
  options,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  description: string;
  value: PrivacyLevel;
  options: { value: PrivacyLevel; label: string }[];
  onChange: (value: PrivacyLevel) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1">
      <div className="flex items-start gap-2 flex-1 min-w-0">
        <span className="text-gray-400 mt-0.5 shrink-0">{icon}</span>
        <div className="space-y-0.5 min-w-0">
          <Label className="text-sm font-medium">{label}</Label>
          <p className="text-xs text-gray-500 dark:text-gray-400">{description}</p>
        </div>
      </div>
      <Select value={value} onValueChange={(v) => onChange(v as PrivacyLevel)}>
        <SelectTrigger className="w-[130px] shrink-0">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
