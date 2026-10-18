import { Suspense } from "react";
import { TransactionsScreen } from "@/components/transactions-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TransactionsScreen />
    </Suspense>
  );
}
