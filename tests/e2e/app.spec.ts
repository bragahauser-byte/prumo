import { expect, test, type Page } from "@playwright/test";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

async function completeOnboarding(page: Page) {
  await page.goto("/onboarding");
  await expect(page.getByRole("heading", { name: "Como podemos te chamar?" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  for (let optionalStep = 0; optionalStep < 3; optionalStep += 1) {
    await page.getByRole("button", { name: "Pular esta etapa" }).click();
  }
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/Li e aceito os termos/).check();
  await page.getByRole("button", { name: "Continuar" }).click();
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
  await page.getByRole("heading", { name: "Como podemos te chamar?" }).waitFor();
  await page.getByLabel("Nome").fill("Ana");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("radio", { name: /Dólar americano/ }).check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Valor líquido mensal").fill("3.500,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Dia do mês").fill("5");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Saldo informado").fill("1.200,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Controlar meus gastos").check();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel(/Li e aceito os termos/).check();
  await page.getByRole("button", { name: "Continuar" }).click();
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
  await page.getByLabel("Valor líquido mensal").fill("3.600,00");
  for (let step = 0; step < 4; step += 1) await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel(/Li e aceito os termos/)).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Concluir e começar" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.reload();
  await page.getByRole("link", { name: /Perfil e preferências/ }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Valor líquido mensal")).toHaveValue("3600,00");
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
});

test("registers an expense with the keypad, suggests its category and marks a bill as paid", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/add");
  await typeOnKeypad(page, "129,9");
  await expect(page.getByLabel("Valor: R$ 129,9")).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByLabel("Com o que foi?").fill("Internet de casa");
  await expect(page.getByRole("radio", { name: "Contas" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("radio", { name: "Vou pagar" }).click();
  await page.getByRole("button", { name: "Salvar gasto" }).click();
  await expect(page.getByRole("heading", { name: "Gasto registrado" })).toBeVisible();
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

test("creates a savings goal and adds money to it", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/goals");
  await page.getByRole("button", { name: "Criar primeira meta" }).click();
  await page.getByRole("radio", { name: "Viagem" }).click();
  await page.getByRole("button", { name: "Digitar" }).click();
  await typeOnKeypad(page, "6000");
  await page.getByRole("button", { name: "Confirmar" }).click();
  await page.getByRole("button", { name: "Criar meta" }).click();
  await expect(page).toHaveURL(/\/goals\/detail\?id=.+/);

  await page.getByRole("link", { name: "Guardar dinheiro" }).click();
  await typeOnKeypad(page, "300");
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Dinheiro guardado" })).toBeVisible();
  await expect(page.getByText("5% da meta · R$ 300,00 de R$ 6.000,00")).toBeVisible();
});

test("sets a category budget from the keypad", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/budgets");
  await page.getByRole("button", { name: /Alimentação/ }).click();
  await typeOnKeypad(page, "800");
  await page.getByRole("button", { name: "Salvar limite" }).click();
  await expect(page.getByText("Limite de Alimentação salvo: R$ 800,00 por mês.")).toBeVisible();
  await expect(page.getByText("Restam R$ 800,00")).toBeVisible();
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
