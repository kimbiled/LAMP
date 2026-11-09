// Единые стили интерфейса: кнопки, поля, бейджи, карточки.
//
// Раньше одна и та же строка классов копировалась по экранам
// (рамка поля — примерно в 20 местах, вторичная кнопка — в 14 вариантах),
// и правка в одном месте не доезжала до остальных. Теперь экраны берут
// классы отсюда. Нужен новый вид — добавьте его здесь, а не на странице.

export type ButtonVariant =
  | "primary" // главное действие: жёлтая кнопка
  | "secondary" // обычное действие: рамка
  | "ghost" // ненавязчивое: «Показать», вкладки, меню
  | "danger" // подтверждение опасного действия (только в окне подтверждения)
  | "danger-outline" // кнопка «Удалить» на странице
  | "positive"; // «Берём дальше», «Рекомендую»

export type ButtonSize = "sm" | "md" | "lg" | "icon" | "icon-sm";

const BUTTON_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-lg font-medium transition " +
  "disabled:cursor-not-allowed disabled:opacity-50";

const BUTTON_VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-accent text-ink hover:bg-accent-hover",
  secondary: "border border-line-strong bg-surface text-ink hover:bg-canvas",
  ghost: "text-ink-soft hover:bg-muted hover:text-ink",
  danger: "bg-danger text-white hover:bg-danger-hover",
  "danger-outline":
    "border border-danger-line bg-surface text-danger hover:bg-danger-soft",
  positive: "bg-khaki-strong text-white hover:bg-khaki-strong-hover",
};

// Высоты: 32 / 40 / 44 px. Квадратные кнопки-иконки — 40 px
// (на телефоне 44), маленькие — 32 px. Меньше 32 не делаем:
// в маленькую кнопку трудно попасть, особенно с телефона.
const BUTTON_SIZES: Record<ButtonSize, string> = {
  sm: "h-8 gap-1.5 px-3 text-xs",
  md: "h-10 gap-2 px-4 text-sm",
  lg: "h-11 gap-2 px-5 text-sm",
  icon: "size-11 sm:size-10",
  "icon-sm": "size-8",
};

export function buttonClass({
  variant = "secondary",
  size = "md",
  full = false,
  className = "",
}: {
  variant?: ButtonVariant;
  size?: ButtonSize;
  full?: boolean;
  className?: string;
} = {}): string {
  return [
    BUTTON_BASE,
    BUTTON_VARIANTS[variant],
    BUTTON_SIZES[size],
    full ? "w-full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

// Поле ввода, выпадающий список, многострочное поле.
// Ширина по умолчанию — во всю строку. Если в className передана своя
// ширина (w-…), она заменяет стандартную, а не спорит с ней.
export function inputClass(error?: boolean | string, className = ""): string {
  const ownWidth = /(^|\s)(\w+:)?w-/.test(className);
  return [
    ownWidth ? "" : "w-full",
    "rounded-lg border bg-surface px-3 py-2 text-sm text-ink outline-none transition",
    "placeholder:text-ink-faint focus:border-ink focus:ring-[3px] focus:ring-accent/40",
    "disabled:cursor-not-allowed disabled:bg-muted disabled:text-ink-soft",
    error ? "border-danger" : "border-line-strong",
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

export const LABEL_CLASS = "block text-sm font-medium text-ink";
export const HINT_CLASS = "mt-1.5 text-xs text-ink-soft";
export const ERROR_TEXT_CLASS = "mt-1.5 text-sm text-danger";

// Бейджи. Цвет говорит о смысле, а не о конкретном поле:
//   success — хорошо (оффер, открыта, берём);
//   danger  — плохо (отказ, заблокирован);
//   warning — требует внимания (в работе, назначено);
//   neutral — неактивно (пауза, закрыта, отменено);
//   info    — справочно;
//   outline — признак, а не статус (канал, приоритет, метка).
export type BadgeTone =
  | "success"
  | "danger"
  | "warning"
  | "neutral"
  | "info"
  | "outline";

const BADGE_TONES: Record<BadgeTone, string> = {
  success: "bg-success-soft text-success-ink",
  danger: "bg-danger-soft text-danger-ink",
  warning: "bg-warning-soft text-ink",
  neutral: "bg-muted text-ink-soft",
  info: "bg-info-soft text-info-ink",
  outline: "border border-line-strong bg-surface text-ink",
};

export function badgeClass(tone: BadgeTone = "neutral", className = ""): string {
  return [
    "inline-flex items-center gap-1 whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-medium",
    BADGE_TONES[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");
}

// Плашки-сообщения внутри страницы: ошибка, успех, подсказка.
export const ALERT_CLASSES = {
  danger: "rounded-lg border border-danger-line bg-danger-soft px-4 py-3 text-sm text-danger-ink",
  success: "rounded-lg border border-success-line bg-success-soft px-4 py-3 text-sm text-success-ink",
  warning: "rounded-lg border border-warning-line bg-warning-soft px-4 py-3 text-sm text-warning-ink",
  info: "rounded-lg border border-info-line bg-info-soft px-4 py-3 text-sm text-info-ink",
} as const;

export const CARD_CLASS = "rounded-xl border border-line bg-surface p-4 sm:p-5";
