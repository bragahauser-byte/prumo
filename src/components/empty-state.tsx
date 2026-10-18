import type { ReactNode } from "react";

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <section
      className="flex min-h-[calc(100dvh-190px)] flex-col items-center justify-center px-4 pb-9 text-center"
      aria-labelledby="empty-state-title"
    >
      <div className="flex max-w-[302px] flex-col items-center">
        <h2 id="empty-state-title" className="text-xl font-semibold leading-[26px] text-[#54545a]">
          {title}
        </h2>
        <p className="mt-1 text-sm leading-5 text-[var(--color-muted)]">{description}</p>
      </div>
      {action ? <div className="mt-6 w-full max-w-[334px]">{action}</div> : null}
    </section>
  );
}
