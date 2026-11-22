import { notFound } from "next/navigation";
import { CatalogView } from "./CatalogView";
import { readCatalog } from "@/lib/server/catalog";
import { pikPakUrl, readDesktopFolderPaths } from "@/lib/server/pikpak-folders";

export async function CatalogPage({ folderId = null }) {
  const { folders: storedFolders, files, useDesktopCache } = await readCatalog(folderId);
  const confirmedRoots = new Set(useDesktopCache
    ? (process.env.STUDIO_SHARE_ROOT_IDS ?? "").split(",").map(id => id.trim()) : []);
  const storedFolderIds = new Set(storedFolders.map(folder => folder.id));
  const folders = storedFolders.map(folder => (
    folder.shareRoot || (confirmedRoots.has(folder.id) && folder.parent && !storedFolderIds.has(folder.parent))
      ? { ...folder, parent: null }
      : folder
  ));
  const byId = new Map(folders.map(folder => [folder.id, folder]));
  const path = [];
  const seen = new Set();
  let id = folderId;

  while (id) {
    const folder = byId.get(id);
    if (seen.has(id) || (!folder && !path.length)) notFound();
    if (!folder) break;
    seen.add(id);
    path.unshift(folder);
    id = folder.parent;
  }

  const items = folderId ? [...folders.filter(folder => folder.parent === folderId), ...files] :
    [...folders.filter(folder => folder.parent === null),
      ...folders.filter(folder => folder.parent !== null && !byId.has(folder.parent))
        .concat(files).map(item => ({ ...item, unresolved: true }))];
  const desktopPaths = useDesktopCache && items.some(item => item.kind === "folder")
    ? await readDesktopFolderPaths() : new Map();
  const catalogItems = items.map(item => item.kind === "folder"
    ? { ...item, pikpakHref: pikPakUrl(item.scanPath) ?? pikPakUrl(desktopPaths.get(item.id)) }
    : item);

  return <CatalogView key={folderId ?? "root"} path={path} folders={folders} items={catalogItems} />;
}
