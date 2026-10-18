import { expect, test, type Page } from "@playwright/test";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

async function completeOnboarding(page: Page) {
  await page.goto("/onboarding");
  await page.getByRole("button", { name: "Criar meu perfil" }).click();
  await expect(page.getByRole("heading", { name: "Como podemos te chamar?" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  for (let optionalStep = 0; optionalStep < 3; optionalStep += 1) {
    await page.getByRole("button", { name: "Pular" }).click();
  }
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Aceitar tudo").check({ force: true });
  await page.getByRole("button", { name: "Concordar e continuar" }).click();
  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/overview$/);
}

async function typeOnKeypad(page: Page, digits: string) {
  await page.getByRole("group", { name: "Teclado numérico" }).waitFor();
  for (const key of digits) await page.getByRole("button", { name: key === "," ? "Vírgula" : key, exact: true }).click();
}

function hasHorizontalOverflow(page: Page) {
  return page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
}

test("onboards a first-time user, saves preferences locally, and restores them after reload", async ({ page }) => {
  test.skip(supabaseConfigured, "This test verifies the local-storage mode.");
  await page.goto("/");
  await expect(page).toHaveURL(/\/onboarding$/);
  await page.getByRole("button", { name: "Criar meu perfil" }).click();
  await page.getByLabel("Nome").fill("Ana");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("heading", { name: "Boas-vindas ao Prumo" })).toBeVisible();
  await expect(page.getByRole("radio", { name: /Real brasileiro/ })).toBeChecked();
  await page.getByRole("radio", { name: /Dólar americano/ }).check({ force: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Valor líquido mensal").fill("3500");
  await expect(page.getByLabel("Valor líquido mensal")).toHaveValue("3.500");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Dia do mês").fill("5");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Saldo informado").fill("1200");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Controlar meus gastos").check({ force: true });
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("button", { name: "Concordar e continuar" })).toBeDisabled();
  await page.getByLabel("Aceitar tudo").check({ force: true });
  await page.getByRole("button", { name: "Concordar e continuar" }).click();
  await page.getByRole("button", { name: "Agora não" }).click();

  await expect(page).toHaveURL(/\/overview$/);
  await expect(page.getByText("Olá, Ana")).toBeVisible();
  await expect(page.getByText("US$ 1.200,00").first()).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("link", { name: /Perfil e preferências/ }).click();
  await expect(page.getByLabel("Nome")).toHaveValue("Ana");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio", { name: /Dólar americano/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Valor líquido mensal").fill("3600");
  for (let step = 0; step < 4; step += 1) await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Aceitar tudo")).toBeChecked();
  await page.getByRole("button", { name: "Concordar e continuar" }).click();
  await page.getByRole("button", { name: "Agora não" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.reload();
  await page.getByRole("link", { name: /Perfil e preferências/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Valor líquido mensal")).toHaveValue("3.600");
});

test("keeps the selected tab and layout consistent across the main screens on mobile", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires an authenticated Supabase test user.");
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);

  const screens = [
    { path: "/overview", title: "Início", tab: "/overview" },
    { path: "/transactions", title: "Transações", tab: "/transactions" },
    { path: "/goals", title: "Metas", tab: "/goals" },
    { path: "/reports", title: "Relatórios", tab: "/reports" },
    { path: "/bills", title: "Agenda" },
    { path: "/budgets", title: "Orçamentos" },
    { path: "/settings", title: "Perfil e ajustes" },
  ];

  for (const screen of screens) {
    await page.goto(screen.path);
    await expect(page.getByRole("heading", { level: 1, name: screen.title, exact: true })).toBeVisible();
    if (screen.tab) {
      const navigation = page.getByRole("navigation", { name: "Navegação principal" }).last();
      await expect(navigation.locator('a[aria-current="page"]')).toHaveAttribute("href", screen.tab);
    }
    expect(await hasHorizontalOverflow(page), `${screen.path} should not overflow horizontally`).toBe(false);
  }

  // Cabeçalho a 64 px do topo e barra de navegação a 40 px da borda inferior.
  const headerTop = await page.getByRole("heading", { level: 1 }).evaluate((element) => element.getBoundingClientRect().top);
  expect(headerTop).toBe(64);
  const navigationBox = await page.getByRole("navigation", { name: "Navegação principal" }).last().boundingBox();
  expect(844 - (navigationBox!.y + navigationBox!.height)).toBe(40);
});

test("registers an expense amount first, picks the suggested category and marks it as paid later", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/add");
  await typeOnKeypad(page, "129,9");
  await expect(page.getByLabel("Valor: R$ 129,9")).toBeVisible();
  await page.getByRole("button", { name: "Gasto", exact: true }).click();
  await page.getByPlaceholder("Categoria ou o que você comprou").fill("Internet de casa");
  await page.getByRole("button", { name: /Contas.*Sugerida pela busca/ }).click();
  await expect(page.getByLabel("Descrição")).toHaveValue("Internet de casa");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Já paguei" }).click();
  await expect(page.getByRole("button", { name: "Vou pagar" })).toBeVisible();
  await page.getByRole("button", { name: "Registrar gasto" }).click();
  await expect(page.getByRole("heading", { name: "Internet de casa" })).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();

  await page.goto("/transactions");
  await page.getByRole("link", { name: /Internet de casa/ }).click();
  await page.getByRole("button", { name: "Marcar como paga" }).click();
  await expect(page.getByText("Marcada como paga.")).toBeVisible();
  await page.getByRole("button", { name: "Excluir transação" }).click();
  await page.getByRole("button", { name: "Sim, excluir" }).click();
  await expect(page).toHaveURL(/\/transactions$/);
  await expect(page.getByRole("heading", { name: "Nenhuma transação ainda" })).toBeVisible();
});

test("creates a savings goal by typing the amount directly and adds money to it", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/goals");
  await page.getByRole("link", { name: "Criar primeira meta" }).click();
  await expect(page).toHaveURL(/\/goals\/new$/);
  await expect(page.getByText(/^\d\/\d$/)).toHaveCount(0);
  await page.getByRole("checkbox", { name: "Viagem" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Valor da meta").fill("6000");
  await expect(page.getByLabel("Valor da meta")).toHaveValue("6.000");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /Em 1 ano/ }).click();
  await page.getByRole("button", { name: "Criar meta" }).click();
  await expect(page).toHaveURL(/\/goals\/detail\?id=.+/);
  await expect(page.getByText("Meta criada com sucesso")).toBeVisible();

  await page.getByRole("link", { name: "Guardar dinheiro" }).click();
  await typeOnKeypad(page, "300");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Viagem" })).toBeVisible();
  await expect(page.getByText("5% · R$ 300,00 de R$ 6.000,00")).toBeVisible();
});

test("creates several goals at once and splits the ring between them", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/goals/new");
  for (const name of ["Viagem", "Carro", "Presente"]) await page.getByRole("checkbox", { name }).click();
  await expect(page.getByRole("img", { name: "3 metas escolhidas" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Valor da meta Viagem").fill("8000");
  await page.getByLabel("Valor da meta Carro").fill("30000");
  await page.getByLabel("Valor da meta Presente").fill("500");
  await expect(page.getByRole("img", { name: "Total das metas: R$ 38.500,00" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radiogroup", { name: "Prazo de Presente" }).getByRole("radio", { name: "Em 6 meses" }).click();
  await page.getByRole("button", { name: "Criar 3 metas" }).click();
  await expect(page).toHaveURL(/\/goals$/);
  await expect(page.getByText("3 metas criadas com sucesso")).toBeVisible();
  for (const name of ["Viagem", "Carro", "Presente"]) await expect(page.getByRole("progressbar", { name: `Progresso de ${name}` })).toBeVisible();
});

test("celebrates when a goal reaches its target, only once", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/goals/new");
  await page.getByRole("checkbox", { name: "Presente" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Valor da meta").fill("500");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Criar meta" }).click();
  await expect(page).toHaveURL(/\/goals\/detail\?id=.+/);

  await page.getByRole("link", { name: "Guardar dinheiro" }).click();
  await typeOnKeypad(page, "500");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await page.getByRole("button", { name: "Concluir" }).click();
  const celebration = page.getByRole("dialog", { name: "Meta atingida!" });
  await expect(celebration).toBeVisible();
  await expect(celebration.getByText(/Você completou Presente/)).toBeVisible();
  await celebration.getByRole("button", { name: "Fechar" }).click();
  await expect(celebration).toBeHidden();
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Meta atingida!" })).toHaveCount(0);
});

test("saves a profile photo and shows it in the header", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/settings");
  const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFklEQVR4nGP4z8DwHwyBNAMDQwMDAwBk1Qf5V+0dGQAAAABJRU5ErkJggg==", "base64");
  await page.locator("input[type=file]").setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: png });
  await expect(page.getByText("Foto de perfil atualizada")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("link", { name: "Perfil e ajustes" }).locator("img")).toHaveAttribute("src", /^data:image\/jpeg;base64,/);
  await page.getByRole("button", { name: "Remover foto" }).click();
  await expect(page.getByRole("link", { name: "Perfil e ajustes" }).locator("img")).toHaveCount(0);
});

test("keeps scheduled reminders off by default and saves the chosen schedule", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/settings/notifications");
  for (const name of ["Revisar as despesas da semana", "Conferir o orçamento no início do mês", "Lembrar contas antes do vencimento", "Insight da semana como notificação"]) {
    await expect(page.getByRole("switch", { name })).toHaveAttribute("aria-checked", "false");
  }
  await page.getByRole("switch", { name: "Revisar as despesas da semana" }).click();
  await page.getByLabel("Dia da semana").selectOption("1");
  await page.getByLabel("Horário da revisão semanal").fill("08:30");
  await expect(page.getByText("Toda segunda-feira, às 08:30.")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("switch", { name: "Revisar as despesas da semana" })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByText("Toda segunda-feira, às 08:30.")).toBeVisible();
});

test("lists an important alert in the notification center when a bill is due tomorrow", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/add");
  await typeOnKeypad(page, "90");
  await page.getByRole("button", { name: "Gasto", exact: true }).click();
  await page.getByPlaceholder("Categoria ou o que você comprou").fill("Conta de luz");
  await page.getByRole("button", { name: /Contas/ }).first().click();
  await page.getByRole("button", { name: "Continuar" }).click();
  const tomorrow = await page.evaluate(() => {
    const date = new Date();
    date.setDate(date.getDate() + 1);
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  });
  await page.getByLabel("Data", { exact: true }).fill(tomorrow);
  await page.getByRole("button", { name: "Registrar gasto" }).click();
  await page.getByRole("button", { name: "Concluir" }).click();
  await page.goto("/overview");
  await page.getByRole("button", { name: "Notificações, 1 nova" }).click();
  await expect(page.getByText("Vence amanhã: Conta de luz")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();
  await expect(page.getByRole("button", { name: "Notificações", exact: true })).toBeVisible();
});

async function registerExpense(page: Page, digits: string, description: string, category: RegExp) {
  await page.goto("/add");
  await typeOnKeypad(page, digits);
  await page.getByRole("button", { name: "Gasto", exact: true }).click();
  await page.getByPlaceholder("Categoria ou o que você comprou").fill(description);
  await page.getByRole("button", { name: category }).first().click();
  await page.getByRole("button", { name: "Continuar" }).click();
}

test("consolidates spending by category, tracks the monthly budget and reports the excess without blocking", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/budgets");
  await page.getByRole("button", { name: /Alimentação/ }).click();
  await typeOnKeypad(page, "400");
  await page.getByRole("button", { name: "Salvar limite" }).click();

  for (const [digits, description] of [["100", "Restaurante japonês"], ["200", "Restaurante árabe"]]) {
    await registerExpense(page, digits, description, /^Alimentação/);
    await page.getByRole("button", { name: "Registrar gasto" }).click();
    await page.getByRole("button", { name: "Concluir" }).click();
  }
  await registerExpense(page, "50", "Farmácia", /^Saúde/);
  await page.getByRole("button", { name: "Registrar gasto" }).click();
  await page.getByRole("button", { name: "Concluir" }).click();
  await registerExpense(page, "300", "Fatura do cartão", /^Pagamento de fatura/);
  await expect(page.getByText("não altera saldo nem orçamento")).toBeVisible();
  await page.getByRole("button", { name: "Registrar movimentação" }).click();
  await page.getByRole("button", { name: "Concluir" }).click();

  await page.goto("/reports/categories");
  const food = page.getByRole("button", { name: /^Alimentação: R\$ 300,00/ });
  await expect(food).toBeVisible();
  await expect(food).toContainText("75% de R$ 400,00 · restam R$ 100,00");
  await expect(page.getByRole("button", { name: /^Saúde: R\$ 50,00/ })).toBeVisible();
  await expect(page.getByText("R$ 350,00").first()).toBeVisible();
  await food.click();
  await expect(page.getByRole("dialog", { name: "Alimentação" }).getByText("2 lançamentos")).toBeVisible();
  await page.getByRole("button", { name: "Fechar" }).click();

  await registerExpense(page, "150", "Mercado", /^Alimentação/);
  await expect(page.getByText(/Alimentação passa R\$\s50,00 do limite de R\$\s400,00/)).toBeVisible();
  await page.getByRole("button", { name: "Registrar gasto" }).click();
  await expect(page.getByText("Orçamento ultrapassado")).toBeVisible();
  await page.getByRole("button", { name: "Concluir" }).click();

  await page.goto("/reports/categories");
  await expect(page.getByRole("button", { name: /^Alimentação: R\$ 450,00/ })).toContainText("excedente de R$ 50,00");
  await page.goto("/budgets");
  await expect(page.getByRole("listitem", { name: "Alimentação: Ultrapassado" })).toBeVisible();

  await page.goto("/reports/categories");
  await page.getByRole("button", { name: "Mês anterior" }).click();
  await expect(page.getByRole("heading", { name: /Nenhum gasto em/ })).toBeVisible();
  await page.reload();
  await page.goto("/budgets");
  await expect(page.getByRole("button", { name: /Alertas de Alimentação: em 80%/ })).toBeVisible();
});

test("sets a category budget from the keypad", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/budgets");
  await page.getByRole("button", { name: /Alimentação/ }).click();
  await typeOnKeypad(page, "800");
  await page.getByRole("button", { name: "Salvar limite" }).click();
  await expect(page.getByText("Limite de Alimentação salvo: R$ 800,00 por mês.")).toBeVisible();
  await expect(page.getByRole("listitem", { name: "Alimentação: Normal" })).toContainText("RestanteR$ 800,00");
});

test("creates and pauses a recurring bill while preserving generated occurrences", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/bills");
  await page.getByRole("button", { name: "Nova recorrência" }).click();
  await page.getByLabel("Nome").fill("Assinatura de música");
  await page.getByRole("button", { name: "Digitar" }).click();
  await typeOnKeypad(page, "24,9");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByRole("radio", { name: "Assinaturas" }).click();
  await page.getByLabel("Dia do vencimento").fill("15");
  await page.getByRole("button", { name: "Criar" }).click();
  await expect(page.getByText(/Assinatura de música: \d+ ocorrência/)).toBeVisible();

  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Assinatura de música pausada. As ocorrências já criadas foram mantidas.")).toBeVisible();
  await expect(page.getByText("Pausada", { exact: true })).toBeVisible();
});

test("redirects old routes to the new structure", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/expenses");
  await expect(page).toHaveURL(/\/transactions$/);
  await page.goto("/insights");
  await expect(page).toHaveURL(/\/reports$/);
});

test("exposes accessible email login and account recovery links", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Acessar sua conta" })).toBeVisible();
  await expect(page.getByLabel("Email")).toHaveAttribute("type", "email");
  await expect(page.getByLabel("Senha")).toHaveAttribute("type", "password");
  await expect(page.getByRole("link", { name: "Criar conta" })).toHaveAttribute("href", "/register");
  await expect(page.getByRole("link", { name: "Esqueci a senha" })).toHaveAttribute("href", "/forgot-password");
});

test("redirects unauthenticated visitors when Supabase is configured", async ({ page }) => {
  test.skip(!supabaseConfigured, "Requires configured Supabase credentials.");

  await page.goto("/overview");
  await expect(page).toHaveURL(/\/login/);
});
