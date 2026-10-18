import { Suspense } from "react";
import { CategoryAnalysisScreen } from "@/components/category-analysis-screen";

export default function Page() {
  return (
    <Suspense fallback={null}>
      <CategoryAnalysisScreen />
    </Suspense>
  );
}
