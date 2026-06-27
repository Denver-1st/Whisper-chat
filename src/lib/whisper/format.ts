/**
 * Time formatting utilities for the Whisper chat UI.
 */

/** Format a timestamp as a relative time string (e.g., "2m", "1h", "Yesterday"). */
export function formatRelativeTime(timestamp: number): string {
  const now = Date.now() / 1000;
  const diff = now - timestamp;

  if (diff < 60) return 'now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  if (diff < 172800) return 'Yesterday';

  const date = new Date(timestamp * 1000);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Format a timestamp as a time string (e.g., "2:30 PM"). */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp * 1000);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/** Format a timestamp as a date separator label (e.g., "Today", "Yesterday", "Jan 15"). */
export function formatDateSeparator(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp * 1000);

  const isToday = now.toDateString() === date.toDateString();
  if (isToday) return 'Today';

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  const isYesterday = yesterday.toDateString() === date.toDateString();
  if (isYesterday) return 'Yesterday';

  return date.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: date.getFullYear() === now.getFullYear() ? undefined : 'numeric' });
}

/** Format a last-seen timestamp (e.g., "last seen 5m ago"). */
export function formatLastSeen(timestamp: number): string {
  const diff = Date.now() / 1000 - timestamp;
  if (diff < 60) return 'just now';
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

/** Check if two timestamps are on the same day. */
export function isSameDay(timestamp1: number, timestamp2: number): boolean {
  return new Date(timestamp1 * 1000).toDateString() === new Date(timestamp2 * 1000).toDateString();
}
