import { Suspense } from "react";
import { AddFlow } from "@/components/add-flow";

export default function AddPage() {
  return (
    <Suspense fallback={<div className="min-h-dvh bg-[var(--color-action)]" aria-hidden="true" />}>
      <AddFlow />
    </Suspense>
  );
}
