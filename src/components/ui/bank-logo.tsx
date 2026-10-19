import Image from "next/image";
import { bankName, hasBankLogo } from "@/domain/banks";
import { asset } from "@/lib/base-path";

/** Logo da instituição em círculo; sem logo, a inicial do nome da conta sobre fundo neutro. */
export function BankLogo({ bank, name, size = 40 }: { bank: string | null; name?: string; size?: number }) {
  if (bank && hasBankLogo(bank)) {
    return (
      <span className="inline-flex shrink-0 overflow-hidden rounded-full border border-black/[0.06] bg-white" style={{ width: size, height: size }} aria-hidden="true">
        <Image src={asset(`/banks/${bank}.webp`)} alt="" width={size} height={size} className="h-full w-full object-cover" />
      </span>
    );
  }
  const initial = (name ?? (bank ? bankName(bank) : "?")).trim().charAt(0).toUpperCase() || "?";
  return (
    <span className="inline-flex shrink-0 items-center justify-center rounded-full bg-[var(--color-soft)] font-semibold text-[var(--color-muted)]" style={{ width: size, height: size, fontSize: Math.max(12, size * 0.4) }} aria-hidden="true">
      {initial}
    </span>
  );
}
