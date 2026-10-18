# Design System

## Direção visual

Interface utilitária e calma, em português brasileiro, com hierarquia por alinhamento, tipografia e divisores. No desktop, a navegação lateral é estável; no celular, uma barra flutuante translúcida usa cápsulas de seleção, cinco destinos e safe area. A referência visual é adaptada ao conteúdo do produto, sem reproduzir símbolos ou elementos proprietários de outra plataforma.

## Tokens

- Fundo: `#F5F5F7`; superfície: `#FFFFFF`.
- Texto: `#1D1D1F`; texto secundário: `#6E6E73`.
- Ação: `#0066CC`; borda: `#E5E5EA`.
- Seleção da navegação: `#EDEDED`; fundo translúcido: branco a 84% com blur e sombra discreta.
- Sucesso: `#1E8E5A`; atenção: `#D97706`; erro: `#D64545`.
- A interface atual prioriza tema claro; tema escuro ainda não está implementado.

## Tipografia e espaçamento

Usa Geist via `next/font`, com escala de interface em 12, 14, 16, 20, 24, 28 e 32 px; os rótulos compactos da barra mobile usam 10 px para acomodar cinco destinos. Espaçamentos seguem múltiplos de 4 px. Valores importantes usam 24 ou 28 px; metadados pequenos têm contraste secundário adequado.

## Controles e acessibilidade

Estados vazios centralizam título e descrição em fundo branco, com ação primária em cápsula azul quando aplicável. Ações principais são arredondadas; a ação de adicionar vira botão de ícone de 44 px no celular, com nome acessível e tooltip nativo.

Campos têm labels semânticos, altura mínima confortável, foco visível e mensagens `role=status`/`role=alert`. A barra mobile destaca aba ativa em cinza claro e azul, respeita `env(safe-area-inset-bottom)` e evita rolagem horizontal. Animações respeitam `prefers-reduced-motion`.

Componentes existentes são EmptyState, formulários de despesa/recorrência/configurações e navegação. Outros componentes só devem ser extraídos quando reutilizados.
