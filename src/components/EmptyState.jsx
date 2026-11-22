import { empty, subtitle } from "@/lib/ui-styles";
import { EmptyFolderArtwork } from "./EmptyFolderArtwork";

export function EmptyState({ heading, illustration: Illustration = EmptyFolderArtwork, children }) {
  return (
    <div className={empty}>
      <Illustration className="w-36 max-w-full sm:w-48" />
      <h2 className={subtitle}>{heading}</h2>
      {children}
    </div>
  );
}
