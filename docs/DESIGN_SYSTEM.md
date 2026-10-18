# Design System

## Direção visual

Interface branca e minimalista, em português brasileiro. Fundo branco; cards brancos com sombra quase imperceptível (`--shadow-card`) e raio de 20 px; seções organizadas por espaçamento, tipografia e divisores — sem grandes áreas cinza. Cinza claro (`--color-soft`) só em controles (campos de busca, botões suaves, chips). Ações finais usam cápsula preta (`inkButton`), como nas referências.

No desktop, a navegação lateral é estável; no celular, uma barra flutuante translúcida traz Início, Extrato, o botão central de adicionar, Metas e Relatórios.

### Telas com referência obrigatória

- **Registro (`/add`)** — teclado em tela cheia na cor de ação com o valor em destaque; botões "Receita", "Guardar" e "Gasto"; painel branco que sobe para escolher categoria (ou meta), descrição, confirmação com chips (data, status, repetição) e comprovante com confete.
- **Onboarding** — boas-vindas em gradiente azul; depois telas brancas com voltar redondo, título grande, campos sublinhados, listas com radio e cápsula preta. Moeda com bandeiras (11 opções, BRL primeiro).
- **Criação de meta (`/goals/new`)** — três etapas com anel de progresso (destino, valor, prazo), versão clara; o valor é digitado direto no campo (`MoneyInput`).

## Tokens de cor (`src/app/globals.css`)

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` | `#FFFFFF` | fundo da página |
| `--color-soft` | `#F5F5F7` | campos, chips, botões suaves |
| `--color-ink` | `#000000` | botões finais em cápsula |
| `--color-surface` | `#FFFFFF` | cartões, painéis |
| `--color-text` | `#1D1D1F` | texto |
| `--color-muted` | `#6E6E73` | texto secundário |
| `--color-border` | `#ECECF0` | divisores |
| `--color-action` / `-soft` | `#0066CC` / `#E8F1FB` | ação, gastos, previsto |
| `--color-success` / `-soft` | `#1E8E5A` / `#E7F4ED` | receitas, recebido, metas |
| `--color-warning` / `-soft` | `#D97706` / `#FDF1E2` | orçamento a 80%, vence hoje |
| `--color-error` / `-soft` | `#D64545` / `#FBEAEA` | atrasado, acima do limite |

Tons derivados: verdes do anel de metas (`goalShades`) e azul claro `#7FB2E5` para gastos variáveis.

## Tipografia

Geist via `next/font`. Escala: **12, 14, 16, 20, 24, 28 e 32 px** (`text-xs`, `text-sm`, `text-base`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`; `text-lg` foi redefinido para 20 px). Títulos de página usam 28 px; valores de destaque, 32 px; números usam algarismos tabulares (`.tabular`). **Exceção única:** o valor em destaque do teclado e do comprovante usa `text-display` (64 px, reduz para 52/44 px em valores longos), para manter a proporção das referências de registro.

## Ícones e ilustrações

- **Ícones de linha** (`public/icons/*.svg`): categorias e metas, aplicados como máscara (`MaskIcon`) para herdar a cor do token. Complementados por Lucide quando não há equivalente.
- **Ilustrações isométricas 3D** (`public/illustrations`, originais em `3d style icons/`, reduzidas a 512 px com fundo transparente), escolhidas pelo significado:
  - `goals` (mapa com marcador) — Metas, **destino**: o que se quer alcançar. Card de Metas e estado vazio.
  - `budgets` (calculadora) — Orçamentos, **distribuição** e controle.
  - `bills` (calendário com marcação) — Agenda, **conclusão**: contas em dia.
  - `reports` (notas com seta de tendência) — Relatórios, **perspectiva** e previsão.
  - `journey` (cofrinho recebendo moedas) — Criação de meta, **jornada**: aporte a aporte.

## Componentes

`Card`, `TileLink`, `Segmented`, `Meter`, `SectionHeader` e classes de botão (`primitives.tsx`); `MoneyKeypad` (e peças `useKeypadInput`, `AmountDisplay`, `KeypadGrid`); `MoneyInput` (digitação direta); `Confetti`; `Sheet` (folha inferior no celular, diálogo no desktop); `ProgressRing`; `StatusChip`; `CategoryIcon`/`GoalIcon`; `ColumnChart`; `TransactionRow`.

## Acessibilidade

Labels semânticos, foco visível, `role=status`/`role=alert` nas mensagens, alvos de toque ≥ 44 px, teclado físico no `MoneyKeypad` (dígitos, vírgula, Backspace, Enter, Esc), gráfico com tabela equivalente, nenhuma informação só por cor (chips têm texto) e animações que respeitam `prefers-reduced-motion`. Sem diálogos nativos do navegador: exclusões pedem confirmação inline.
