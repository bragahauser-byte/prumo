import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="rounded-[28px] border border-[var(--color-border)] bg-[var(--color-surface)] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-[var(--color-muted)]">404</p>
        <h1 className="mt-3 text-3xl font-semibold text-[var(--color-text)]">Page not found</h1>
        <p className="mt-3 text-sm text-[var(--color-muted)]">The requested page does not exist in the current plan.</p>
        <Link href="/overview" className="mt-6 inline-flex rounded-full bg-[var(--color-action)] px-4 py-2 text-sm font-medium text-white">
          Return to overview
        </Link>
      </div>
    </div>
  );
}
