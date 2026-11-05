import type { SourceChannel } from "@/generated/prisma/enums";
import { SOURCE_CHANNELS } from "@/lib/source-channel";

// Метка канала привлечения рядом с этапом: холодный поиск, тёплый контакт
// или реферал. Канал необязателен, поэтому без него метка не рисуется.

export function ChannelBadge({ channel }: { channel: SourceChannel | null }) {
  const item = SOURCE_CHANNELS.find((entry) => entry.value === channel);
  if (!item) return null;

  const Icon = item.icon;

  return (
    <span
      title="Канал привлечения"
      className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium ${item.badge}`}
    >
      <Icon className="h-3.5 w-3.5" strokeWidth={2} />
      {item.label}
    </span>
  );
}
