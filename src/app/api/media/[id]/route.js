import { readCatalogMediaItem } from "@/lib/server/catalog";
import { desktopFileId } from "@/lib/server/desktop-cache";
import { readDesktopMedia } from "@/lib/server/media";

const headers = { "Cache-Control": "private, no-store" };

export async function GET(_request, { params }) {
  const { id } = await params;
  const item = desktopFileId.test(id) ? await readCatalogMediaItem(id) : null;
  if (!item) return Response.json(null, { headers, status: 404 });

  const desktop = !item.preview && item.useDesktopCache ? await readDesktopMedia(item) : null;
  const preview = item.preview ?? desktop?.preview ?? null;
  const fileInfo = desktop?.fileInfo ?? item.fileInfo ?? null;
  if (!preview && !fileInfo) return Response.json(null, { headers, status: 404 });

  const payload = preview
    ? { ...preview, ...(fileInfo ? { fileInfo } : {}) }
    : { kind: "none", fileInfo };
  return Response.json(payload, { headers, status: 200 });
}
