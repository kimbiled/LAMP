// Фотография кандидата, а если её нет — кружок с инициалами.
//
// Фото вынимается из резюме при загрузке и лежит в хранилище, поэтому
// сюда передаётся не сам файл, а признак «фото есть»: адрес собирается
// здесь, чтобы не повторять его на каждой странице.

export function Avatar({
  name,
  size = "md",
  candidateId,
  hasPhoto = false,
}: {
  name: string;
  size?: "sm" | "md" | "lg";
  // Нужен, только если показываем фото.
  candidateId?: string;
  hasPhoto?: boolean;
}) {
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

  if (hasPhoto && candidateId) {
    return (
      // Обычный img, а не next/image: файл отдаётся нашим же адресом
      // с проверкой прав, и оптимизатору его не прочитать.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`/api/candidates/${candidateId}/photo`}
        alt={name}
        loading="lazy"
        className={`shrink-0 rounded-full bg-muted object-cover ${sizes[size]}`}
      />
    );
  }

  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full bg-muted font-medium text-ink ${sizes[size]}`}
    >
      {initials}
    </span>
  );
}
