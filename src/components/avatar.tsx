// Кружок с инициалами вместо фотографии.

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" | "lg" }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");

  const sizes = {
    sm: "h-8 w-8 text-xs",
    md: "h-10 w-10 text-sm",
    lg: "h-14 w-14 text-base",
  };

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-ink ${sizes[size]}`}
    >
      {initials}
    </span>
  );
}
