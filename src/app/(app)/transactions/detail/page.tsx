import { Suspense } from "react";
import { TransactionDetail } from "@/components/transaction-detail";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TransactionDetail />
    </Suspense>
  );
}
