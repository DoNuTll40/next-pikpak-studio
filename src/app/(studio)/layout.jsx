import { StudioShell } from "@/components/StudioShell";
import { StudioProvider } from "@/providers/StudioProvider";

export default function StudioLayout({ children }) {
  return (
    <StudioProvider>
      <StudioShell>{children}</StudioShell>
    </StudioProvider>
  );
}
