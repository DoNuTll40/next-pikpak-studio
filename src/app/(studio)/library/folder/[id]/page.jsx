import { CatalogPage } from "@/components/CatalogPage";

export const instant = false;

export default async function Folder({ params }) {
  return <CatalogPage folderId={(await params).id} />;
}
