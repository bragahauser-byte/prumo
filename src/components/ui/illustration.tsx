import Image from "next/image";
import { asset } from "@/lib/base-path";

/**
 * Ilustrações isométricas 3D (bnbicons.com), uma por conceito de produto.
 * Os originais ficam em `3d style icons/`; aqui estão reduzidos a 512 px com fundo transparente.
 */
export const illustrations = {
  goals: "Mapa com marcador: o destino que você quer alcançar",
  budgets: "Calculadora: distribuir e equilibrar o dinheiro entre categorias",
  bills: "Calendário com marcação concluída: contas em dia",
  reports: "Pilha de notas com seta de tendência: perspectiva e previsão",
  journey: "Cofrinho recebendo moedas: o caminho, aporte a aporte, até a meta",
} as const;

export type IllustrationName = keyof typeof illustrations;

export function Illustration({
  name,
  size = 96,
  className = "",
  priority,
}: {
  name: IllustrationName;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src={asset(`/illustrations/${name}.png`)}
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      priority={priority}
      className={`shrink-0 select-none object-contain ${className}`}
      draggable={false}
    />
  );
}
