"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import { useAssistant } from "@/components/assistant/assistant-context";
import { Card, focusRing, textButton } from "@/components/ui/primitives";
import { investmentTypes, type InvestmentType } from "@/domain/investments";
import { investmentColors } from "./investments-screen";

/** Pontos práticos neutros para comparar os tipos; sem promessa de rendimento. */
const traits: Record<InvestmentType, { risk: string; liquidity: string }> = {
  poupanca: { risk: "Baixo", liquidity: "Resgate a qualquer momento" },
  cdb_rdb: { risk: "Baixo a moderado", liquidity: "Depende do título: diário ou no vencimento" },
  tesouro: { risk: "Baixo; o preço oscila se vender antes do vencimento", liquidity: "Resgate em dias úteis, pelo preço do dia" },
  acoes: { risk: "Alto: o preço varia todos os dias", liquidity: "Venda na bolsa em dias úteis" },
  fiis: { risk: "Moderado a alto: cotas oscilam", liquidity: "Venda na bolsa em dias úteis" },
  fundos_etfs: { risk: "Varia conforme a carteira do fundo", liquidity: "Depende do fundo; ETFs são vendidos na bolsa" },
  lci_lca: { risk: "Baixo a moderado", liquidity: "Costuma ter prazo mínimo de carência" },
  cripto: { risk: "Muito alto: grandes oscilações", liquidity: "Negociação contínua, sujeita à plataforma" },
};

export function InvestmentGuide() {
  const { openAssistant } = useAssistant();
  return (
    <div className="mx-auto max-w-[720px] space-y-4">
      <p className="px-1 text-base leading-6 text-[var(--color-muted)]">Um resumo informativo dos tipos mais comuns no Brasil. Não é recomendação: rendimentos passados não garantem resultados futuros, e cada pessoa tem objetivos, prazos e tolerância a risco diferentes.</p>
      <ol className="space-y-3">
        {investmentTypes.map((item, index) => (
          <li key={item.id}>
            <Card className="p-5">
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-[var(--color-text)]" style={{ backgroundColor: `${investmentColors[item.id]}33` }} aria-hidden="true">{index + 1}</span>
                <div className="min-w-0">
                  <h2 className="text-lg font-semibold leading-7">{item.name}</h2>
                  <p className="mt-1 text-base leading-6 text-[var(--color-muted)]">{item.description}</p>
                  <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
                    <div><dt className="text-xs font-medium text-[var(--color-tertiary)]">Risco</dt><dd className="text-[var(--color-text)]">{traits[item.id].risk}</dd></div>
                    <div><dt className="text-xs font-medium text-[var(--color-tertiary)]">Resgate</dt><dd className="text-[var(--color-text)]">{traits[item.id].liquidity}</dd></div>
                  </dl>
                </div>
              </div>
            </Card>
          </li>
        ))}
      </ol>
      <Card className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <p className="flex-1 text-sm leading-5 text-[var(--color-muted)]">Ficou com dúvida sobre algum tipo? O assistente explica de forma neutra, sem indicar produtos.</p>
        <button type="button" onClick={() => openAssistant("Me explique a diferença entre CDB, Tesouro Direto e LCI/LCA de forma simples")} className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[var(--color-highlight-soft)] px-4 text-sm font-semibold text-[var(--color-highlight-pressed)] ${focusRing}`}>
          <Sparkles size={16} aria-hidden="true" /> Perguntar ao assistente
        </button>
      </Card>
      <Link href="/investments" className={textButton}>Voltar aos meus investimentos</Link>
    </div>
  );
}
