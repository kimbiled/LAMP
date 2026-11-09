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
    active: "border-cold-line bg-cold-soft text-cold-ink",
    badge: "bg-cold-soft text-cold-ink",
  },
  {
    value: "WARM",
    label: SOURCE_CHANNEL_LABELS.WARM,
    icon: Flame,
    active: "border-warm-line bg-warm-soft text-warm-ink",
    badge: "bg-warm-soft text-warm-ink",
  },
  {
    value: "REFERRAL",
    label: SOURCE_CHANNEL_LABELS.REFERRAL,
    icon: UserPlus,
    active: "border-referral-line bg-referral-soft text-referral-ink",
    badge: "bg-referral-soft text-referral-ink",
  },
];
