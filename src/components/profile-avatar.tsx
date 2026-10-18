import Image from "next/image";
import { UserRound } from "lucide-react";

/** Foto de perfil, ou a inicial do nome sobre um fundo verde claro quando não há foto. */
export function ProfileAvatar({ name, photo, size = 44, inverse = false }: { name: string | null | undefined; photo: string | null | undefined; size?: number; inverse?: boolean }) {
  const initial = name?.trim().charAt(0).toLocaleUpperCase("pt-BR");
  if (photo) {
    return <Image src={photo} alt="" width={size} height={size} unoptimized className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />;
  }
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${inverse ? "bg-[var(--color-forest-green)] text-[var(--color-bright-green)]" : "bg-[var(--color-bright-green)] text-[var(--color-forest-green)]"}`}
      style={{ width: size, height: size, fontSize: size >= 80 ? 32 : size >= 56 ? 24 : 16 }}
      aria-hidden="true"
    >
      {initial || <UserRound size={Math.round(size * 0.45)} />}
    </span>
  );
}
