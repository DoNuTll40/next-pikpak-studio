import { notFound } from "next/navigation";
import { StudioSection } from "@/components/StudioSection";
import { StudioAccountProfile } from "@/components/StudioAccountProfile";
import { requireStudioUser } from "@/lib/server/session";
import { readHistory, readScans } from "@/lib/server/catalog";

export default async function Section({ params }) {
  const { section } = await params;
  switch (section) {
    case "scans":
      return <StudioSection section={section} folders={await readScans()} />;
    case "history":
      return <StudioSection section={section} history={await readHistory()} />;
    case "settings":
      await requireStudioUser();
      return (
        <StudioSection section={section} accountSettings={<StudioAccountProfile />} />
      );
    default:
      notFound();
  }
}
