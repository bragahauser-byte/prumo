import { Suspense } from "react";
import { GoalDetail } from "@/components/goal-detail";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <GoalDetail />
    </Suspense>
  );
}
