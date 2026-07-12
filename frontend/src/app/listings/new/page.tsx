"use client";

import { Suspense } from "react";
import NewPropertyPage from "./new-property-form";
import { AppShell } from "@/components/app-shell";
import { LoadingSpinner } from "@/components/ui";

export default function NewPropertyRoute() {
  return (
    <Suspense
      fallback={
        <AppShell>
          <LoadingSpinner />
        </AppShell>
      }
    >
      <NewPropertyPage />
    </Suspense>
  );
}
