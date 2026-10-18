import {
  Banknote,
  Laptop,
  RotateCcw,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";
import type { TransactionKind } from "@/domain/categories";
import { asset } from "@/lib/base-path";

type IconSource = { svg: string } | { lucide: LucideIcon };

const categoryIcons: Record<string, IconSource> = {
  Moradia: { svg: "house" },
  Alimentação: { svg: "dining" },
  Transporte: { svg: "car" },
  Saúde: { svg: "health" },
  Contas: { svg: "wifi" },
  Assinaturas: { svg: "tv" },
  Lazer: { svg: "beach" },
  Compras: { lucide: ShoppingBag },
  Educação: { svg: "workspace" },
  Outros: { svg: "box" },
  Salário: { svg: "office" },
  Freelance: { lucide: Laptop },
  Reembolso: { lucide: RotateCcw },
  Rendimentos: { lucide: TrendingUp },
  "Outras receitas": { lucide: Banknote },
};

export const goalIcons: { value: string; label: string; svg: string }[] = [
  { value: "travel", label: "Viagem", svg: "beach" },
  { value: "emergency", label: "Reserva de emergência", svg: "emergency" },
  { value: "computer", label: "Computador", svg: "workspace" },
  { value: "house", label: "Casa", svg: "house" },
  { value: "car", label: "Carro", svg: "car" },
  { value: "adventure", label: "Aventura", svg: "tent" },
  { value: "fitness", label: "Saúde e bem-estar", svg: "gym" },
  { value: "music", label: "Música", svg: "piano" },
  { value: "other", label: "Outro objetivo", svg: "box" },
];

/** Ícone de linha (SVG em /public/icons) aplicado como máscara para herdar a cor do texto. */
export function MaskIcon({ name, size = 24, className = "" }: { name: string; size?: number; className?: string }) {
  const url = `url(${asset(`/icons/${name}.svg`)})`;
  return (
    <span
      aria-hidden="true"
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{
        width: size,
        height: size,
        maskImage: url,
        WebkitMaskImage: url,
        maskSize: "contain",
        WebkitMaskSize: "contain",
        maskRepeat: "no-repeat",
        WebkitMaskRepeat: "no-repeat",
        maskPosition: "center",
        WebkitMaskPosition: "center",
      }}
    />
  );
}

export function CategoryGlyph({ category, size = 24 }: { category: string; size?: number }) {
  const source = categoryIcons[category];
  if (!source) return <Sparkles size={size * 0.75} aria-hidden="true" />;
  if ("svg" in source) return <MaskIcon name={source.svg} size={size} />;
  const Icon = source.lucide;
  return <Icon size={size * 0.75} strokeWidth={1.75} aria-hidden="true" />;
}

export function CategoryIcon({
  category,
  kind = "expense",
  size = 44,
}: {
  category: string;
  kind?: TransactionKind;
  size?: number;
}) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full ${kind === "income" ? "bg-[var(--color-success-soft)] text-[var(--color-success)]" : "bg-[var(--color-soft)] text-[var(--color-text)]"}`}
      style={{ width: size, height: size }}
    >
      <CategoryGlyph category={category} size={Math.round(size * 0.68)} />
    </span>
  );
}

export function GoalIcon({ icon, size = 44 }: { icon: string; size?: number }) {
  const source = goalIcons.find((item) => item.value === icon) ?? goalIcons[goalIcons.length - 1];
  return (
    <span className="flex shrink-0 items-center justify-center rounded-full bg-[var(--color-action-soft)] text-[var(--color-action)]" style={{ width: size, height: size }}>
      <MaskIcon name={source.svg} size={Math.round(size * 0.68)} />
    </span>
  );
}

