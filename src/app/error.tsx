"use client";

export default function Error({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6 text-center">
      <p className="text-sm uppercase tracking-[0.2em] text-[var(--color-muted)]">Error</p>
      <h2 className="text-2xl font-semibold text-[var(--color-text)]">Something went wrong.</h2>
      <button onClick={() => reset()} className="rounded-full bg-[var(--color-action)] px-4 py-2 text-sm font-medium text-white">
        Try again
      </button>
    </div>
  );
}
