# Product Specification

## Proposta

O Prumo não movimenta dinheiro. Ele ajuda a pessoa a entender a situação financeira, tomar decisões melhores e antecipar problemas antes que aconteçam. As funcionalidades se organizam em três níveis: **entender** o dinheiro, **planejar** o dinheiro e **melhorar a relação** com o dinheiro.

## Funcionalidades essenciais

| # | Funcionalidade | Onde está | O que entrega |
|---|---|---|---|
| 1 | Dashboard financeiro | `/overview` (Início) | Saldo disponível (informado e ajustado pelo que foi pago/recebido), receitas e despesas do mês com comparação ao mês anterior, quanto ainda pode gastar, próximos vencimentos e atalhos. |
| 2 | Registro de receitas e despesas | `/add`, `/transactions`, `/transactions/[id]` | Teclado de valor em tela cheia, categoria sugerida pela descrição, edição, exclusão, busca, filtros (tipo, categoria, status, fixo/variável, período) e repetição. |
| 3 | Orçamento por categoria | `/budgets` | Limite mensal por categoria, consumo, quanto resta, alertas a 80% e acima de 100% (também no registro de gasto). |
| 4 | Contas a pagar e a receber | `/bills` (Agenda) | Atrasadas, próximos 7 dias e mais adiante; status previsto, pago, recebido, vence hoje ou atrasado; recorrência semanal, mensal, anual ou personalizada (a cada N períodos). |
| 5 | Metas financeiras | `/goals`, `/goals/[id]` | Valor-alvo, prazo, aportes realizados ou planejados, quanto guardar por mês e progresso. O dinheiro continua na conta do usuário. |
| 6 | Relatórios e insights | `/reports` | Evolução de seis meses, categorias que mais consomem, comparação entre períodos, aumentos incomuns e estimativa de sobra no fim do mês. |

## Experiência de valores

Sempre que o usuário digita dinheiro (gasto, receita, aporte em meta, limite de orçamento, saldo, valor de meta ou recorrência), o app abre o mesmo teclado em tela cheia: o valor vem primeiro, os detalhes depois. Azul indica gasto/ação; verde indica entrada ou dinheiro guardado.

## Regras de cálculo

- **Saldo atual** = saldo informado + receitas recebidas − despesas pagas a partir da data em que o saldo foi informado.
- **Quanto ainda pode gastar** = saldo atual + receitas a receber até o fim do mês − contas a pagar até o fim do mês (inclui atrasadas) − dinheiro guardado em metas − aportes planejados até o fim do mês. Sem saldo informado: renda do mês − despesas do mês − aportes do mês.
- **Aumento incomum**: gasto da categoria no mês ≥ 130% da média dos três meses anteriores e ao menos R$ 50 acima dela.
- **Gasto fixo** é a ocorrência gerada por uma recorrência; os demais são variáveis.

## Restrições

- Sem integração bancária, sem dados fabricados e sem recomendação de investimento, crédito ou empréstimo.
- Estimativas usam apenas os registros e os valores informados; não são saldo bancário confirmado.
- Categorias personalizadas, notificações push de orçamento, tema escuro e exclusão de conta continuam fora do escopo.
