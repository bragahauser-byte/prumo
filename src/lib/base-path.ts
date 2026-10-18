/** Prefixo do site quando publicado num subcaminho (ex.: GitHub Pages em /prumo). Vazio no desenvolvimento. */
export const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

/** Caminho de um arquivo em /public considerando o prefixo do site. */
export function asset(path: string) {
  return `${basePath}${path}`;
}
