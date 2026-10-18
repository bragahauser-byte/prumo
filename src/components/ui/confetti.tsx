const colors = ["#0066CC", "#1E8E5A", "#D97706", "#D64545", "#7FB2E5", "#78C9A0", "#1D1D1F"];

/** Pseudoaleatório determinístico para o confete ter a mesma forma em toda renderização. */
function noise(seed: number) {
  const value = Math.sin(seed * 12.9898) * 43758.5453;
  return value - Math.floor(value);
}

const pieces = Array.from({ length: 56 }, (_, index) => ({
  left: noise(index + 1) * 100,
  delay: noise(index + 101) * 0.6,
  duration: 1.8 + noise(index + 201) * 1.4,
  drift: (noise(index + 301) - 0.5) * 160,
  spin: 360 + noise(index + 401) * 540,
  width: 6 + noise(index + 501) * 6,
  round: noise(index + 601) > 0.7,
  color: colors[index % colors.length],
}));

/** Chuva de confete de comemoração. Decorativa: some sozinha e respeita "reduzir movimento". */
export function Confetti() {
  return (
    <div className="pointer-events-none fixed inset-0 z-[60] overflow-hidden" aria-hidden="true">
      {pieces.map((piece, index) => (
        <span
          key={index}
          className="absolute top-0 block"
          style={{
            left: `${piece.left}%`,
            width: piece.width,
            height: piece.round ? piece.width : piece.width * 1.6,
            borderRadius: piece.round ? "50%" : 2,
            backgroundColor: piece.color,
            animation: `confetti-fall ${piece.duration}s cubic-bezier(0.25, 0.6, 0.4, 1) ${piece.delay}s both`,
            ["--drift" as string]: `${piece.drift}px`,
            ["--spin" as string]: `${piece.spin}deg`,
          }}
        />
      ))}
    </div>
  );
}
