// O export estático do Next 16 grava os dados de pré-carregamento por segmento em subpastas
// (ex.: overview/__next.!KGFwcCk/overview/__PAGE__.txt), mas o navegador os pede com o caminho
// "achatado" (overview/__next.!KGFwcCk.overview.__PAGE__.txt). Sem servidor para reescrever a URL,
// como no GitHub Pages, criamos também a versão achatada de cada arquivo.
import { copyFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const root = process.argv[2] ?? "out";
let created = 0;

function flatten(baseDir, segmentDir, parts) {
  for (const entry of readdirSync(segmentDir)) {
    const full = join(segmentDir, entry);
    if (statSync(full).isDirectory()) flatten(baseDir, full, [...parts, entry]);
    else {
      copyFileSync(full, join(baseDir, [...parts, entry].join(".")));
      created += 1;
    }
  }
}

function walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (!statSync(full).isDirectory()) continue;
    if (entry.startsWith("__next.")) flatten(dir, full, [entry]);
    else walk(full);
  }
}

walk(root);
console.log(`flatten-rsc-segments: ${created} arquivo(s) criados em ${root}`);
