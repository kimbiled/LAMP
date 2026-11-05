import { Flame, Snowflake, UserPlus } from "lucide-react";
import type { SourceChannel } from "@/generated/prisma/enums";
import { SOURCE_CHANNEL_LABELS } from "@/lib/labels";

// Каналы привлечения: откуда взялся кандидат. Иконка и цвет одни и те же
// в форме и на метке карточки, чтобы канал узнавался с одного взгляда:
// снежинка — холод, огонь — тепло, человек с плюсом — привели свои.
export const SOURCE_CHANNELS: {
  value: SourceChannel;
  label: string;
  icon: typeof Flame;
  // Кнопка в форме, когда канал выбран.
  active: string;
  // Метка в шапке карточки и в списке.
  badge: string;
}[] = [
  {
    value: "COLD",
    label: SOURCE_CHANNEL_LABELS.COLD,
    icon: Snowflake,
    active: "border-ink-soft bg-muted text-ink",
    badge: "bg-muted text-ink-soft",
  },
  {
    value: "WARM",
    label: SOURCE_CHANNEL_LABELS.WARM,
    icon: Flame,
    active: "border-accent bg-glow text-ink",
    badge: "bg-glow text-ink",
  },
  {
    value: "REFERRAL",
    label: SOURCE_CHANNEL_LABELS.REFERRAL,
    icon: UserPlus,
    active: "border-khaki bg-khaki-soft text-khaki-ink",
    badge: "bg-khaki-soft text-khaki-ink",
  },
];
