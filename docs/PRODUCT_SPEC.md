# Product Specification

## Proposta

O Prumo não movimenta dinheiro. Ele ajuda a pessoa a entender a situação financeira, tomar decisões melhores e antecipar problemas antes que aconteçam. As funcionalidades se organizam em três níveis: **entender** o dinheiro, **planejar** o dinheiro e **melhorar a relação** com o dinheiro.

## Funcionalidades essenciais

| # | Funcionalidade | Onde está | O que entrega |
|---|---|---|---|
| 1 | Dashboard financeiro | `/overview` (Início) | Saldo disponível (informado e ajustado pelo que foi pago/recebido), receitas e despesas do mês com comparação ao mês anterior, quanto ainda pode gastar, próximos vencimentos e atalhos. |
| 2 | Registro de receitas e despesas | `/add`, `/transactions`, `/transactions/detail?id=` | Teclado de valor em tela cheia, categoria sugerida pela descrição, edição, exclusão, busca, filtros (tipo, categoria, status, fixo/variável, período) e repetição. |
| 3 | Orçamento por categoria | `/budgets` | Limite mensal por categoria, consumo, quanto resta, alertas a 80% e acima de 100% (também no registro de gasto). |
| 4 | Contas a pagar e a receber | `/bills` (Agenda) | Atrasadas, próximos 7 dias e mais adiante; status previsto, pago, recebido, vence hoje ou atrasado; recorrência semanal, mensal, anual ou personalizada (a cada N períodos). |
| 5 | Metas financeiras | `/goals`, `/goals/new`, `/goals/detail?id=` | Doze categorias com ilustração 3D; criação de uma ou várias metas de uma vez (sem limite); valor-alvo, prazo, aportes realizados ou planejados, quanto guardar por mês, anel dividido entre as metas e barra com a marca do ritmo esperado para hoje. Comemoração em tela cheia quando a meta é atingida. O dinheiro continua na conta do usuário. |
| 6 | Relatórios e insights | `/reports` | Evolução de seis meses, categorias que mais consomem, comparação entre períodos, aumentos incomuns e estimativa de sobra no fim do mês. |

## Experiência de valores

- **Registro** (gasto, receita ou aporte): valor primeiro num teclado em tela cheia; depois "Receita", "Guardar" ou "Gasto", categoria (ou meta), descrição e confirmação.
- **Ajustes rápidos** (saldo, limite de orçamento, valor de recorrência): o mesmo teclado.
- **Metas e onboarding**: digitação direta no campo, com teclado numérico do celular e formatação da moeda.

## Notificações

Quatro níveis, calculados no aparelho (`src/domain/notifications.ts`) e reunidos no sino do cabeçalho:

1. **Alertas importantes**: conta atrasada, que vence hoje ou amanhã; orçamento a partir de 80% ou acima do limite; meta com prazo em até três meses e ritmo abaixo do planejado. Só existem quando há uma ação útil. Podem virar notificação do sistema (ligado por padrão quando o usuário permite notificações).
2. **Lembretes programados**: revisão semanal das despesas (dia e horário), orçamento no início do mês (horário, do dia 1 ao 3) e contas com 2, 3, 5 ou 7 dias de antecedência. Todos desligados por padrão; o usuário escolhe em `/settings/notifications`.
3. **Insights**: no máximo três, por relevância — mês que pode fechar no negativo, meta quase completa (80% ou mais), categoria com gasto fora do comum, categoria com gasto 15% menor que no mesmo período do mês anterior e estimativa de sobra. Como notificação, só o principal e no máximo um por semana (desligado por padrão).
4. **Confirmações**: aviso discreto na tela (toast) ou junto ao conteúdo; nunca notificação do sistema.

Cada notificação tem um identificador estável e é enviada uma vez por aparelho. Sem servidor, as notificações do sistema só são geradas com o app aberto em alguma aba.

## Perfil

Foto de perfil opcional, escolhida em Ajustes: recortada em quadrado e reduzida para 256 px antes de salvar.

## Moeda de exibição

Real brasileiro primeiro, seguido de USD, EUR, JPY, GBP, CNY, AUD, CAD, CHF, HKD e NZD. A escolha muda só a formatação (inclusive casas decimais, como o iene sem centavos); não há conversão cambial.

## Regras de cálculo

- **Saldo atual** = saldo informado + receitas recebidas − despesas pagas a partir da data em que o saldo foi informado.
- **Quanto ainda pode gastar** = saldo atual + receitas a receber até o fim do mês − contas a pagar até o fim do mês (inclui atrasadas) − dinheiro guardado em metas − aportes planejados até o fim do mês. Sem saldo informado: renda do mês − despesas do mês − aportes do mês.
- **Aumento incomum**: gasto da categoria no mês ≥ 130% da média dos três meses anteriores e ao menos R$ 50 acima dela.
- **Gasto fixo** é a ocorrência gerada por uma recorrência; os demais são variáveis.

## Restrições

- Sem integração bancária, sem dados fabricados e sem recomendação de investimento, crédito ou empréstimo.
- Estimativas usam apenas os registros e os valores informados; não são saldo bancário confirmado.
- Categorias personalizadas, notificações enviadas por servidor (com o app fechado), tema escuro e exclusão de conta continuam fora do escopo.
