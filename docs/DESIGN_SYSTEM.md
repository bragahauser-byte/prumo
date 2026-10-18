# Design System

## Direção visual

Interface branca e minimalista, em português brasileiro. Fundo branco; cards brancos com sombra quase imperceptível (`--shadow-card`) e raio de 20 px; seções organizadas por espaçamento, tipografia e divisores — sem grandes áreas cinza. O neutro (`--color-soft`) só aparece em controles (campos de busca, botões suaves, chips). Ações principais usam cápsula verde viva com texto verde floresta (`inkButton`/`primaryButton`).

No desktop, a navegação lateral é estável; no celular, uma barra flutuante translúcida traz Início, Extrato, o botão central de adicionar, Metas e Relatórios, a **40 px da borda inferior**.

**Cabeçalho das telas:** título e subtítulo no mesmo tamanho (24 px), diferenciados só por peso e cor — título em `--color-text` semibold, subtítulo em `--color-tertiary` regular. No celular começa a **64 px do topo**. À direita, o sino de notificações (com contador de novos alertas e lembretes) e a foto de perfil.

**Logo e carregamento:** a bússola tem versão clara (`public/brand/logo-light.svg`) e escura (`logo-dark.svg`), escolhidas por `prefers-color-scheme` no favicon (`brand/icon.svg`), nos PNGs de ícone e no `BrandLogo`. A tela de carregamento (`LoadingScreen`) usa fundo `#0F0F0F` e a agulha oscila entre −19,83° e 48,84° em 2,8 s, ida e volta, com curva suave.

### Telas com referência obrigatória

- **Registro (`/add`)** — teclado em tela cheia em verde vivo, com valor e texto em verde floresta; botões "Receita", "Guardar" e "Gasto"; painel branco que sobe para escolher categoria (ou meta), descrição, confirmação com chips (data, status, repetição) e comprovante com confete.
- **Onboarding** — boas-vindas em gradiente verde floresta; depois telas brancas com voltar redondo, título grande, campos sublinhados, listas com radio e cápsula preta. Moeda com bandeiras (11 opções, BRL primeiro).
- **Criação de meta (`/goals/new`)** — três etapas (destinos, valores, prazos), versão clara, sem contador de etapas visível. Dá para escolher várias metas de uma vez: o anel se divide entre elas — em partes iguais na escolha, proporcional ao valor de cada uma e, no prazo, proporcional ao que cada uma pede por mês (referência `inspiracao tela de criacao de meta/2.png`). O valor é digitado direto no campo (`MoneyInput`).
- **Meta atingida** — tela cheia em verde floresta, troféu 3D (`goal-reached`) que surge girando com raios, brilho pulsante, ondas de choque, estilhaços, confete, título "Meta atingida!" letra a letra em verde vivo e o valor contando até o total. Aparece uma vez por meta, depois do comprovante; vibra no celular e respeita "reduzir movimento".

## Tokens de cor (`src/app/globals.css`)

| Grupo | Token | Valor | Uso |
|---|---|---|---|
| Fundações | `--color-base-contrast` / `--color-base-light` / `--color-base-dark` | `#FFFFFF` / `#21231D` / `#0E0F0C` | superfícies de máximo contraste, fundos escuros, texto de ancoragem |
| Principais | `--color-bright-green` | `#9FE870` | crescimento, metas alcançadas, ações de destaque, teclado de valor |
| | `--color-forest-green` | `#163300` | solidez: texto sobre verde vivo, controles, links, progresso |
| Secundárias | `--color-bright-orange` / `-yellow` / `-blue` / `-pink` | `#FFC091` / `#FFEB69` / `#A0E1E1` / `#FFD7EF` | categorias, metas no anel, confete |
| Tons escuros | `--color-dark-purple` / `-gold` / `-charcoal` / `-maroon` | `#260A2F` / `#3A341C` / `#21231D` / `#320707` | fatias escuras do anel de metas, profundidade |
| Conteúdo | `--color-text` / `--color-muted` / `--color-tertiary` / `--color-link` | `#0E0F0C` / `#454745` / `#6A6C6A` / `#163300` | títulos, descrições, auxiliares e datas, links |
| Interação | `--color-action` / `--color-accent` / `--color-secondary` / `--color-on-accent` | `#163300` / `#9FE870` / `#868685` / `#163300` | primária, CTA e foco ativo, secundária, controle sobre o CTA |
| Superfícies | `--color-bg` / `--color-surface` / `--color-soft` / `--color-overlay` | `#FFFFFF` / `#FFFFFF` / `#F0F2EE` / `rgba(14,15,12,.48)` | tela, cards e modais, blocos neutros, sobreposição |
| Bordas | `--color-border` / `--color-border-overlay` | `#E5E7E3` / `#C9CCC6` | divisores, bordas de controles e campos ativos |
| Sentimento | `--color-success` / `--color-warning` (+ `-fill`) / `--color-error` | `#2F5711` / `#8A6100` (`#EDC843`) / `#A8200D` | sucesso e metas batidas, atenção, erro e saldo negativo; cada um com `-soft` para fundos |

**Entradas e saídas:** `--color-income` (`#2F5711`) para o que entra e `--color-expense` (`#C7271A`) para o que sai, em valores, totais e gráficos. Gráficos: despesas em vermelho e receitas em verde vivo (contraste alto entre si). Metas no anel usam `goalShades`, alternando tons escuros e claros para que fatias vizinhas nunca se confundam; cada fatia tem legenda com nome e porcentagem.

## Tipografia

Geist via `next/font`. Escala: **12, 14, 16, 20, 24, 28 e 32 px** (`text-xs`, `text-sm`, `text-base`, `text-xl`, `text-2xl`, `text-3xl`, `text-4xl`; `text-lg` foi redefinido para 20 px). Título e subtítulo do cabeçalho usam 24 px; títulos de fluxos em tela cheia (onboarding, criação de meta), 28 a 32 px; valores de destaque, 32 px; números usam algarismos tabulares (`.tabular`). **Exceção única:** o valor em destaque do teclado e do comprovante usa `text-display` (64 px, reduz para 52/44 px em valores longos), para manter a proporção das referências de registro.

## Ícones e ilustrações

- **Ícones de linha** (`public/icons/*.svg`): categorias e metas, aplicados como máscara (`MaskIcon`) para herdar a cor do token. Complementados por Lucide quando não há equivalente.
- **Ilustrações isométricas 3D** (`public/illustrations`, originais em `3d style icons/`, reduzidas a 512 px com fundo transparente), escolhidas pelo significado:
  - `goals` (mapa com marcador) — Metas, **destino**: o que se quer alcançar. Card de Metas e estado vazio.
  - `budgets` (calculadora) — Orçamentos, **distribuição** e controle.
  - `bills` (calendário com marcação) — Agenda, **conclusão**: contas em dia.
  - `reports` (notas com seta de tendência) — Relatórios, **perspectiva** e previsão.
  - `journey` (cofrinho recebendo moedas) — Criação de meta, **jornada**: aporte a aporte.
  - `goal-reached` (troféu com moedas) — comemoração de meta atingida.
- **Ilustrações de meta** (`public/goal-icons`, originais em `icones 3d para tela de metas/`, 256 px com fundo transparente), na ordem de frequência: Viagem, Reserva de emergência, Eletrônicos, Carro, Casa, Educação, Saúde e bem-estar, Casamento e família, Aventura, Ingresso, Presente e Outros objetivos.

## Componentes

`Card`, `TileLink`, `Segmented`, `Meter`, `SectionHeader` e classes de botão (`primitives.tsx`); `MoneyKeypad` (e peças `useKeypadInput`, `AmountDisplay`, `KeypadGrid`); `MoneyInput` (digitação direta); `Confetti`; `Sheet` (folha inferior no celular, diálogo no desktop); `ProgressRing` (arcos com pontas arredondadas descontadas do comprimento, respiro entre fatias, valor pequeno vira ponto, marcador no fim e animação de entrada); `GoalProgressBar` (preenchimento + marca do esperado para hoje); `Toast` (confirmações); `NotificationBell`; `ProfileAvatar`; `GoalCelebration`; `StatusChip`; `CategoryIcon`/`GoalIcon`; `ColumnChart`; `TransactionRow`.

## Acessibilidade

Labels semânticos, foco visível, `role=status`/`role=alert` nas mensagens, alvos de toque ≥ 44 px, teclado físico no `MoneyKeypad` (dígitos, vírgula, Backspace, Enter, Esc), gráfico com tabela equivalente, nenhuma informação só por cor (chips têm texto) e animações que respeitam `prefers-reduced-motion`. Sem diálogos nativos do navegador: exclusões pedem confirmação inline.
