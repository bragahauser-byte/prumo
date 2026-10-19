// Prepara uma cópia descartável do projeto para o build estático do GitHub Pages.
// Remove o que depende de servidor (login Supabase, Server Actions, rota de callback e proxy);
// no Pages o app funciona só no modo local, com os dados no navegador.
// Por segurança, só roda no CI ou com --force, para não apagar arquivos da sua pasta de trabalho.
import { rmSync } from "node:fs";

if (!process.env.CI && !process.argv.includes("--force")) {
  console.error("prepare-pages: rode apenas no CI ou numa cópia descartável (use --force).");
  process.exit(1);
}

const serverOnly = [
  "proxy.ts",
  "src/app/(auth)",
  "src/app/auth",
  "src/app/(app)/actions.ts",
  "src/app/(app)/settings/password",
  // Assistente de IA: precisa de servidor (proxy para a API da Anthropic). No Pages, o chat mostra um aviso.
  "src/app/api",
];

for (const path of serverOnly) {
  rmSync(path, { recursive: true, force: true });
  console.log(`prepare-pages: removido ${path}`);
}
