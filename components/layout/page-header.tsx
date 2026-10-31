/** Title block shared by the top-level pages. */
export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">{title}</h1>
        {description && <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">{description}</p>}
      </div>
      {actions}
    </div>
  );
}
