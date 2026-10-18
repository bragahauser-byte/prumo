import { asset } from "@/lib/base-path";

/**
 * Logo do Prumo. Versão clara (fundo branco, traço verde floresta) e escura (fundo preto, traço verde vivo);
 * o navegador escolhe pela preferência de tema do sistema.
 */
export function BrandLogo({ size = 36, className = "" }: { size?: number; className?: string }) {
  return (
    <picture className={`shrink-0 ${className}`}>
      <source srcSet={asset("/brand/logo-dark.svg")} media="(prefers-color-scheme: dark)" />
      <img src={asset("/brand/logo-light.svg")} alt="" width={size} height={size} className="rounded-[22%] ring-1 ring-black/5" style={{ width: size, height: size }} />
    </picture>
  );
}

/**
 * Bússola do logo. A agulha oscila devagar entre −19,83° e 48,84°, com aceleração suave nas pontas,
 * como uma bússola se acomodando. Com "reduzir movimento", fica parada.
 */
export function CompassMark({ size = 138, color = "var(--color-bright-green)" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 139 139" fill="none" aria-hidden="true">
      <path d="M126.72 69.12C126.72 100.932 100.932 126.72 69.1201 126.72C37.3085 126.72 11.5201 100.932 11.5201 69.12C11.5201 37.3084 37.3085 11.52 69.1201 11.52C100.932 11.52 126.72 37.3084 126.72 69.12Z" stroke={color} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      <g className="compass-needle">
        <path d="M93.5425 44.6976L81.3313 81.3312L44.6977 93.5424L56.9089 56.9088L93.5425 44.6976Z" stroke={color} strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" />
      </g>
    </svg>
  );
}

/** Tela de carregamento: fundo quase preto e a bússola em verde vivo. */
export function LoadingScreen({ label = "Carregando o Prumo" }: { label?: string }) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#0F0F0F]" role="status" aria-live="polite">
      <CompassMark />
      <span className="sr-only">{label}</span>
    </div>
  );
}
