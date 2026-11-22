import { Suspense } from "react";
import { StudioSplitLayout } from "./StudioSplitLayout";
import { StudioContent } from "./StudioContent";
import { StudioAccountProfile } from "./StudioAccountProfile";

export function StudioShell({ children }) {
  return (
    <StudioSplitLayout account={
      <Suspense fallback={<div className="min-h-14" />}>
        <StudioAccountProfile linkToSettings />
      </Suspense>
    }>
      <StudioContent>{children}</StudioContent>
    </StudioSplitLayout>
  );
}
