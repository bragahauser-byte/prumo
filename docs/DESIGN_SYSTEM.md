# Design System

## Direção visual

Interface calma e utilitária, em português brasileiro. Fundo cinza claro com cartões brancos de cantos generosos (24 px), números grandes e poucos elementos por bloco. No desktop, a navegação lateral é estável; no celular, uma barra flutuante translúcida traz Início, Extrato, o botão central de adicionar, Metas e Relatórios. Agenda, Orçamentos e Ajustes ficam nos atalhos da tela inicial e no avatar.

Os momentos de colocar dinheiro seguem a lógica "valor primeiro": teclado em tela cheia na cor da ação, número em destaque e um único botão branco. A referência é o padrão de interação, sem reproduzir marca, cores ou elementos proprietários de outra plataforma.

## Tokens de cor (`src/app/globals.css`)

| Token | Valor | Uso |
|---|---|---|
| `--color-bg` / `--color-soft` | `#F5F5F7` | fundo da página, botões suaves |
| `--color-surface` | `#FFFFFF` | cartões, painéis |
| `--color-text` | `#1D1D1F` | texto, cartão de metas |
| `--color-muted` | `#6E6E73` | texto secundário |
| `--color-border` | `#E5E5EA` | divisores |
| `--color-action` / `-soft` | `#0066CC` / `#E8F1FB` | ação, gastos, previsto |
| `--color-success` / `-soft` | `#1E8E5A` / `#E7F4ED` | receitas, recebido, metas |
| `--color-warning` / `-soft` | `#D97706` / `#FDF1E2` | orçamento a 80%, vence hoje |
| `--color-error` / `-soft` | `#D64545` / `#FBEAEA` | atrasado, acima do limite |

Tons derivados: verdes do anel de metas (`goalShades`) e azul claro `#7FB2E5` para gastos variáveis.

## Tipografia

Geist via `next/font`. Escala única: **12, 14, 16, 20, 24, 28 e 32 px** (`text-xs`, `text-sm`, `text-base`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`; `text-lg` foi redefinido para 20 px). Títulos de página usam 28 px; valores de destaque, 32 px; números usam algarismos tabulares (`.tabular`).

## Ícones e ilustrações

- **Ícones de linha** (`public/icons/*.svg`): categorias e metas, aplicados como máscara (`MaskIcon`) para herdar a cor do token. Complementados por Lucide quando não há equivalente.
- **Ilustrações isométricas 3D** (`public/illustrations/*.png`, geradas em bnbicons.com): listadas em `src/components/ui/illustration.tsx`. Enquanto o arquivo não existir, o componente mostra um bloco neutro com o ícone de linha. Para ativar uma ilustração, coloque o PNG com o nome indicado e adicione o nome em `availableIllustrations`.

## Componentes

`Card`, `TileLink`, `Segmented`, `Meter`, `SectionHeader` e classes de botão (`primitives.tsx`); `MoneyKeypad`; `Sheet` (folha inferior no celular, diálogo no desktop); `ProgressRing`; `StatusChip`; `CategoryIcon`/`GoalIcon`; `ColumnChart`; `TransactionRow`.

## Acessibilidade

Labels semânticos, foco visível, `role=status`/`role=alert` nas mensagens, alvos de toque ≥ 44 px, teclado físico no `MoneyKeypad` (dígitos, vírgula, Backspace, Enter, Esc), gráfico com tabela equivalente, nenhuma informação só por cor (chips têm texto) e animações que respeitam `prefers-reduced-motion`. Sem diálogos nativos do navegador: exclusões pedem confirmação inline.
