"use client";

import { categoriesFor, type TransactionKind } from "@/domain/categories";
import { CategoryGlyph } from "@/components/ui/category-icon";
import { focusRing } from "@/components/ui/primitives";

export function CategoryPicker({
  kind,
  value,
  onChange,
  suggested,
}: {
  kind: TransactionKind;
  value: string;
  onChange: (category: string) => void;
  suggested?: string | null;
}) {
  return (
    <fieldset>
      <legend className="text-sm font-medium">Categoria</legend>
      <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4" role="radiogroup" aria-label="Categoria">
        {categoriesFor(kind).map((category) => {
          const selected = value === category;
          return (
            <button
              key={category}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => onChange(category)}
              className={`relative flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl border px-2 py-3 text-center text-xs font-semibold transition-colors ${focusRing} ${selected
                ? kind === "income"
                  ? "border-[var(--color-success)] bg-[var(--color-success-soft)] text-[var(--color-success)]"
                  : "border-[var(--color-action)] bg-[var(--color-action-soft)] text-[var(--color-action)]"
                : "border-[var(--color-border)] bg-white text-[var(--color-text)] hover:bg-[var(--color-soft)]"}`}
            >
              <CategoryGlyph category={category} size={28} />
              <span className="w-full truncate">{category}</span>
              {suggested === category && !selected ? <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-[var(--color-action)]" aria-label="Sugerida" /> : null}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
