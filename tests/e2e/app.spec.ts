import { expect, test } from "@playwright/test";

const supabaseConfigured = Boolean(
  process.env.NEXT_PUBLIC_SUPABASE_URL &&
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

async function completeOnboarding(page: import("@playwright/test").Page) {
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
  await expect(page.getByText(/US\$/).first()).toBeVisible();
  await page.goto("/settings");
  await expect(page.getByLabel("Nome")).toHaveValue("Ana");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio", { name: /Dólar americano/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Valor líquido mensal")).toHaveValue("3500,00");
  await page.getByLabel("Valor líquido mensal").fill("3.600,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Dia do mês")).toHaveValue("5");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Saldo informado")).toHaveValue("1200,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel(/Li e aceito os termos/)).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Concluir e começar" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await page.reload();
  await expect(page.getByLabel("Nome")).toHaveValue("Ana");
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByRole("radio", { name: /Dólar americano/ })).toBeChecked();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Valor líquido mensal")).toHaveValue("3600,00");
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Continuar" }).click();
  await expect(page.getByLabel("Saldo informado")).toHaveValue("1200,00");
});

test("navigates to expenses and keeps the mobile layout within the viewport", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await page.setViewportSize({ width: 390, height: 844 });
  await completeOnboarding(page);
  await page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Despesas" }).click();

  await expect(page).toHaveURL(/\/expenses$/);
  await expect(page.getByRole("heading", { name: "Despesas", exact: true })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegação principal" }).getByRole("link", { name: "Despesas" })).toBeVisible();
  const hasHorizontalOverflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(hasHorizontalOverflow).toBe(false);
});

test("keeps the selected tab and layout consistent across all five mobile screens", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires an authenticated Supabase test user.");
  await page.setViewportSize({ width: 402, height: 874 });
  await completeOnboarding(page);

  const screens = [
    { path: "/overview", title: "Visão geral" },
    { path: "/expenses", title: "Despesas" },
    { path: "/recurring", title: "Recorrências" },
    { path: "/insights", title: "Insights" },
    { path: "/settings", title: "Configurações" },
  ];

  for (const screen of screens) {
    await page.goto(screen.path);
    await expect(page.getByRole("heading", { name: screen.title, exact: true })).toBeVisible();
    const navigation = page.getByRole("navigation", { name: "Navegação principal" });
    const selectedTab = navigation.locator('a[aria-current="page"]');
    await expect(selectedTab).toHaveAttribute("href", screen.path);
    const overflows = await page.evaluate(
      () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
    );
    expect(overflows, `${screen.path} should not overflow horizontally`).toBe(false);
  }
});

test("creates, pays, edits, deletes, and reloads an expense", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/expenses");
  await page.getByRole("button", { name: "Adicionar despesa" }).first().click();
  const createForm = page.getByRole("region", { name: "Nova despesa" });
  await createForm.getByLabel("Descrição").fill("Internet de casa");
  await createForm.getByLabel("Valor (BRL)").fill("129,90");
  await createForm.getByRole("combobox", { name: "Categoria" }).selectOption("Contas");
  const dueDate = new Date();
  dueDate.setUTCDate(dueDate.getUTCDate() + 2);
  await createForm.getByLabel("Vencimento").fill(dueDate.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "Salvar despesa" }).click();
  await expect(page.getByRole("heading", { name: "Internet de casa" })).toBeVisible();

  await page.getByRole("button", { name: "Marcar como paga" }).click();
  await expect(page.getByText("Pagamento registrado.")).toBeVisible();
  await expect(page.getByText("Paga", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Editar", exact: true }).click();
  const editForm = page.getByRole("region", { name: "Editar despesa" });
  await editForm.getByLabel("Descrição").fill("Internet atualizada");
  await editForm.getByLabel("Valor (BRL)").fill("150,00");
  await editForm.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByRole("heading", { name: "Internet atualizada" })).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByRole("heading", { name: "Internet atualizada" })).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("heading", { name: "Seu mês começa aqui" })).toBeVisible();
});

test("creates and pauses a recurring rule while preserving generated occurrences", async ({ page }) => {
  test.skip(supabaseConfigured, "Requires a configured authenticated test account.");
  await completeOnboarding(page);
  await page.goto("/recurring");
  await page.getByRole("button", { name: "Adicionar recorrência" }).first().click();
  await page.getByLabel("Nome").fill("Assinatura de música");
  await page.getByLabel("Valor de referência").fill("24,90");
  await page.getByLabel("Categoria").selectOption("Assinaturas");
  await page.getByLabel("Frequência").selectOption("monthly");
  await page.getByLabel("Data inicial").fill(new Date().toISOString().slice(0, 10));
  await page.getByLabel("Dia do vencimento (mensal/anual)").fill("15");
  await page.getByLabel("O valor pode mudar a cada ocorrência").check();
  await page.getByRole("button", { name: "Salvar recorrência" }).click();

  await expect(page.getByRole("heading", { name: "Assinatura de música" })).toBeVisible();
  await expect(page.getByText("valor variável")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByText("Regra pausada; ocorrências existentes foram mantidas.")).toBeVisible();
  await expect(page.getByText(/Assinaturas.*Pausada/)).toBeVisible();
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
