"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { EmptyState } from "@/components/empty-state";
import { ExpenseForm } from "@/components/expense-form";
import { useFinance } from "@/components/finance-provider";

export default function EditExpensePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { expenses } = useFinance();
  const expense = expenses.find((item) => item.id === id);

  if (!expense) {
    return <EmptyState title="Despesa não encontrada" description="Ela pode ter sido removida. Volte à lista para consultar os registros atuais." action={<Link href="/expenses" className="inline-flex min-h-[52px] w-full items-center justify-center rounded-full bg-[var(--color-action)] px-5 text-sm font-semibold text-white">Voltar às despesas</Link>} />;
  }

  return (
    <section>
      <Link href="/expenses" className="text-sm underline underline-offset-4">Voltar às despesas</Link>
      <h2 className="mt-5 text-xl font-semibold">Editar despesa</h2>
      <ExpenseForm expense={expense} onSaved={() => router.replace("/expenses")} onCancel={() => router.back()} />
    </section>
  );
}
