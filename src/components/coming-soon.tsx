// Заглушка для разделов, которые появятся на следующих этапах.

export function ComingSoon({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="text-xl font-semibold text-ink-strong">{title}</h1>
      <div className="mt-6 rounded-xl border border-dashed border-muted bg-surface p-8 text-center">
        <p className="text-sm text-ink-soft">{description}</p>
      </div>
    </div>
  );
}
