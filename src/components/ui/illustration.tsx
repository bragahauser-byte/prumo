import Image from "next/image";
import { MaskIcon } from "@/components/ui/category-icon";

/**
 * Ilustrações isométricas 3D (geradas em bnbicons.com) ficam em /public/illustrations/<nome>.png.
 * Enquanto um arquivo não existir, a entrada fica fora de `availableIllustrations`
 * e o componente mostra um bloco neutro com o ícone de linha correspondente.
 */
export const illustrations = {
  wallet: { label: "Carteira", fallback: "office" },
  "piggy-bank": { label: "Cofrinho", fallback: "emergency" },
  calendar: { label: "Calendário", fallback: "wifi" },
  jar: { label: "Pote de orçamento", fallback: "dining" },
  chart: { label: "Gráfico", fallback: "workspace" },
  coins: { label: "Moedas", fallback: "office" },
  receipt: { label: "Recibo", fallback: "box" },
  success: { label: "Tudo certo", fallback: "beach" },
  "goal-travel": { label: "Viagem", fallback: "beach" },
  "goal-emergency": { label: "Reserva de emergência", fallback: "emergency" },
  "goal-computer": { label: "Computador", fallback: "workspace" },
  "goal-house": { label: "Casa", fallback: "house" },
  "goal-car": { label: "Carro", fallback: "car" },
  "goal-adventure": { label: "Aventura", fallback: "tent" },
  "goal-fitness": { label: "Bem-estar", fallback: "gym" },
  "goal-music": { label: "Música", fallback: "piano" },
  "goal-other": { label: "Objetivo", fallback: "box" },
} as const;

export type IllustrationName = keyof typeof illustrations;

const availableIllustrations = new Set<IllustrationName>([]);

export function Illustration({
  name,
  size = 96,
  className = "",
}: {
  name: IllustrationName;
  size?: number;
  className?: string;
}) {
  if (availableIllustrations.has(name)) {
    return <Image src={`/illustrations/${name}.png`} alt="" width={size} height={size} className={`shrink-0 object-contain ${className}`} aria-hidden="true" />;
  }

  return (
    <span
      aria-hidden="true"
      className={`flex shrink-0 items-center justify-center rounded-[28%] bg-[linear-gradient(145deg,#ffffff_0%,var(--color-action-soft)_100%)] text-[var(--color-action)] shadow-[inset_0_0_0_1px_rgba(0,102,204,0.08)] ${className}`}
      style={{ width: size, height: size }}
    >
      <MaskIcon name={illustrations[name].fallback} size={Math.round(size * 0.56)} />
    </span>
  );
}

export function goalIllustration(icon: string): IllustrationName {
  const name = `goal-${icon}` as IllustrationName;
  return name in illustrations ? name : "goal-other";
}
