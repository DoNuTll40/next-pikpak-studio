# เชื่อม PikPak Studio Desktop กับ Production

## 1. เปิดเซสชัน Studio

โดเมน Production คือ `https://pikpak-studio.vercel.app`

1. เปิดโดเมน HTTPS ของ Vercel Production ใน WebView สำหรับ Studio และให้ผู้ใช้ล็อกอินด้วย Google, LINE หรือ Facebook
2. ส่งคำขอทุกตัวจากหน้า Studio บนโดเมนเดียวกัน (`credentials: "same-origin"`) เพื่อให้เบราว์เซอร์แนบ session cookie และ header `Origin: https://pikpak-studio.vercel.app`
3. แยก WebView ที่เปิด PikPak ออกจาก WebView ของ Studio อย่าส่งต่อคุกกี้หรือ token ล็อกอินของ Studio ให้หน้า PikPak และตรวจ origin ของ WebView ก่อนส่งข้อมูลผ่าน bridge ทุกครั้ง

---

## 2. รายการ Desktop API ทั้งหมด (`/api/desktop/*`)

ทุกเส้นทางตอบด้วย `Cache-Control: private, no-store` และใช้สถานะข้อผิดพลาดมาตรฐานเดียวกัน:
- `401` (`sign_in_required`) — ยังไม่ได้ล็อกอินหรือเซสชันหมดอายุ (ให้หยุดส่งและพาผู้ใช้ล็อกอินใหม่)
- `403` (`invalid_origin`) — `Origin` ไม่ตรงกับ `BETTER_AUTH_URL`
- `400` — รูปแบบ JSON หรือฟิลด์ไม่ถูกต้อง
- `413` (`batch_too_large`) — ขนาด body เกิน `512 KiB` (ให้แบ่ง batch เล็กลง)
- `415` (`json_required`) — ไม่ได้ส่ง `Content-Type: application/json`
- `503` — ฐานข้อมูลหรือบริการไม่พร้อมชั่วคราว (ให้ retry แบบมี backoff)

### 2.1 `GET /api/desktop/session` — ตรวจบัญชีปัจจุบันก่อน flush คิว

ใช้เช็กสถานะล็อกอินและรหัสคลัง (`accountId`) เพื่อแยกคิวซิงก์ตามบัญชีและป้องกันการส่งผิดคลังหลังสลับบัญชี

- **Response `200`**:
  ```json
  {
    "authenticated": true,
    "accountId": "f490777c-b754-49fd-9e2a-127ac672a303",
    "user": {
      "id": "kAYZ2bIJlPEXMsVOPMwrikMbowEWJvlk",
      "name": "DONUŤ",
      "email": "iinter731@gmail.com",
      "image": "https://..."
    }
  }
  ```
- **Response `401`**: `{ "authenticated": false, "error": "sign_in_required" }`

### 2.2 `POST /api/desktop/sync` — ซิงก์รายการคลัง, รูปปก และ `file_info`

จำกัดไม่เกิน **100 รายการรวม** และ **512 KiB** ต่อคำขอ

| ข้อมูลจาก Desktop | ตัวอย่าง payload |
| --- | --- |
| รายการจาก `detail` ในแต่ละหน้า | `{ "detail": { "files": [item] } }` |
| รายการ catalog ที่เตรียมแล้ว | `{ "catalog": [item] }` |
| รายละเอียดจาก `save_browser_video_info` | `{ "file_info": item }` หรือ `{ "file_info": [item] }` |

- แต่ละ item ต้องมี `id`, `name` และ `kind` (`drive#folder` / `drive#file` / `folder` / `file`)
- ส่ง `parent_id`, `mime_type`, `size`, `modified_time`, `thumbnail_link` (หรือ `params.small_thumbnail`) เมื่อมี
- สำหรับโฟลเดอร์ที่ Desktop ยืนยันว่าเป็นแชร์หลัก ให้ใส่ `share_root: true`
- ส่งแต่ละหน้าแยกกัน โดยเก็บ `next_page_token` และ `pass_code_token` ไว้ฝั่ง Desktop
- **Response `200`**: `{ "synced": 12 }`

### 2.3 `POST /api/desktop/scans` — ซิงก์และอ่านสถานะสแกนโฟลเดอร์ (`studio.scan_folders`)

ใช้แทน `http://127.0.0.1:17646/scan-folders` เดิม รองรับทั้งส่งทีละโฟลเดอร์ (เข้ากันได้กับ `browser_scan_checkpoint`), อ่านลูกอย่างเดียว, และส่งแบบ batch (สูงสุด 100 รายการ)

- **อ่านลูกของ path อย่างเดียว** (ไม่ส่ง `status`):
  ```json
  { "path": "/s/abc123" }
  ```
- **อัปเดตสถานะ 1 โฟลเดอร์ + อ่านลูกของโฟลเดอร์นั้น**:
  ```json
  {
    "path": "/s/abc123/folder1",
    "parentPath": "/s/abc123",
    "folderId": "VOlAXVeGjtZMRzTsji2uSu1qo2",
    "name": "Folder Name",
    "status": "pending"
  }
  ```
  *(ค่า `status` ที่รองรับ: `"pending"`, `"partial"`, `"complete"` — ระบบจะไม่ลดสถานะจาก `"complete"` กลับเป็น `"pending"`)*
- **ส่งแบบ batch (สูงสุด 100 รายการ)**:
  ```json
  {
    "checkpoints": [
      { "path": "/s/abc123", "parentPath": null, "folderId": "...", "name": "Root", "status": "partial" }
    ],
    "queryPath": "/s/abc123"
  }
  ```
- **Response `200`**:
  ```json
  {
    "synced": 1,
    "children": [
      {
        "path": "/s/abc123/folder1",
        "parentPath": "/s/abc123",
        "folderId": "VOlAXVeGjtZMRzTsji2uSu1qo2",
        "name": "Folder Name",
        "status": "complete",
        "updatedAt": 1795326000000
      }
    ]
  }
  ```

### 2.4 `POST /api/desktop/history` — ซิงก์ประวัติการเปิดดู (`studio.watch_history`)

รองรับทั้ง 1 รายการและแบบ batch สูงสุด **100 รายการ** (ถ้าไฟล์ยังไม่อยู่ใน `studio.catalog_items` จะถูกข้ามโดยไม่ error และรายงานจำนวนใน `skipped`)

- **ส่ง 1 รายการ**:
  ```json
  { "file_id": "VOTYDw3Q8p8r40mvSvXzj9geo2", "viewed_at": "2026-11-22T05:30:00.000Z" }
  ```
  *(รองรับ `fileId` / `id` และ `viewedAt` ทั้ง ISO string หรือ epoch ms; ถ้าไม่ส่งเวลาจะใช้เวลาปัจจุบัน)*
- **ส่งแบบ batch**:
  ```json
  {
    "items": [
      { "file_id": "fileA", "viewed_at": 1795326000000 },
      { "file_id": "fileB", "viewed_at": "2026-11-22T05:31:00.000Z" }
    ]
  }
  ```
- **Response `200`**: `{ "synced": 2, "skipped": 0 }`

### 2.5 `POST /api/desktop/saved-ids` — ตรวจรายการที่เก็บไว้แล้วใน Neon

ใช้เสริม `saved_browser_file_ids` ฝั่ง Desktop เพื่อเช็กข้ามเครื่องว่า `file_id` ไหนมีข้อมูลในคลังแล้วหรือมีลิงก์พรีวิวที่ยังไม่หมดอายุ (สูงสุด **500 ID** ต่อคำขอ)

- **Request**:
  ```json
  { "ids": ["fileA", "fileB", "fileC"] }
  ```
- **Response `200`**:
  ```json
  {
    "catalog": ["fileA", "fileB"],
    "saved": ["fileA"],
    "fresh": ["fileA"]
  }
  ```
  - `catalog`: ID ที่มีอยู่ใน `studio.catalog_items` แล้ว
  - `saved`: ID ที่มี `file_info` บันทึกไว้แล้ว
  - `fresh`: ID ที่มี `file_info.preview` และลิงก์ยังไม่หมดอายุ ณ เวลาที่ถาม

---

## 3. ตัวอย่างการเรียกจาก Studio WebView

```js
async function studioPost(path, payload) {
  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Studio API ${path} failed (${response.status})`);
  }
  return response.json();
}

const session = await fetch("/api/desktop/session", { credentials: "same-origin" }).then(r => r.json());
if (!session.authenticated) throw new Error("Sign in required");

await studioPost("/api/desktop/sync", { detail: { files: detailResponse.files } });
await studioPost("/api/desktop/sync", { file_info: capturedFileInfo });
const { children } = await studioPost("/api/desktop/scans", { path, parentPath, folderId, name, status });
await studioPost("/api/desktop/history", { file_id: capturedFileInfo.id, viewed_at: Date.now() });
const { saved, fresh } = await studioPost("/api/desktop/saved-ids", { ids: pageFileIds });
```

บนฝั่ง Desktop ให้เก็บคิวที่รอซิงก์แยกตาม `session.accountId` ส่งซ้ำเมื่อได้ `503` หรือเครือข่ายขาด หยุดรอให้ล็อกอินเมื่อได้ `401` และตรวจ `accountId` ใหม่ทุกครั้งหลังสลับบัญชี
