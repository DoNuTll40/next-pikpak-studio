# เชื่อม PikPak Studio Desktop กับ Production

## เปิดเซสชัน Studio

โดเมนที่ตั้งไว้สำหรับ Production คือ `https://pikpak-studio.vercel.app` ให้ใช้เมื่อ deploy และตั้งค่า OAuth เสร็จแล้ว

1. เปิดโดเมน HTTPS ของ Vercel Production ใน WebView สำหรับ Studio และให้ผู้ใช้ล็อกอินด้วย Google, LINE หรือ Facebook
2. ส่งข้อมูลจากหน้า Studio บนโดเมนเดียวกัน โดยใช้เซสชันของ WebView นั้น เว็บจะเลือกคลังจากบัญชีที่ล็อกอินเอง
3. ส่งคำขอจาก WebView ของ Studio ผ่าน bridge ที่รับข้อมูลจากฝั่ง Desktop แยกจาก WebView ที่เปิด PikPak อย่าส่งต่อคุกกี้หรือ token ล็อกอินให้หน้า PikPak และตรวจ origin ของ WebView ก่อนส่งข้อมูลผ่าน bridge

## ส่งข้อมูล

ใช้ `POST /api/desktop/sync` กับ `Content-Type: application/json` จำกัดไม่เกิน 100 รายการรวมและ 512 KiB ต่อคำขอ

| ข้อมูลจาก Desktop | ตัวอย่าง payload |
| --- | --- |
| รายการจาก `detail` ในแต่ละหน้า | `{ "detail": { "files": [item] } }` |
| รายการ catalog ที่เตรียมแล้ว | `{ "catalog": [item] }` |
| รายละเอียดจาก `save_browser_video_info` | `{ "file_info": item }` หรือ `{ "file_info": [item] }` |

แต่ละ item ต้องมี `id`, `name` และ `kind` เช่น `drive#folder` หรือ `drive#file` ส่ง `parent_id`, `mime_type`, `size`, `modified_time` และ `thumbnail_link` เมื่อมี สำหรับโฟลเดอร์ที่ Desktop ยืนยันว่าเป็นแชร์หลัก ให้ใส่ `share_root: true`

ให้ Desktop ดึงหน้าถัดไปของ PikPak จนครบโดยใช้ `next_page_token` แล้วส่งรายการของแต่ละหน้าแยกกัน ส่งเฉพาะ `files` หรือ `file_info` ที่ต้องใช้ โดยเก็บ pagination token และ passcode token ไว้ฝั่ง Desktop

```js
// เรียกจากหน้า Studio ใน WebView ที่ล็อกอินแล้ว
async function syncToStudio(payload) {
  const response = await fetch("/api/desktop/sync", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Studio sync failed (${response.status})`);
  }
  return response.json();
}

await syncToStudio({ detail: { files: detailResponse.files } });
await syncToStudio({ file_info: capturedFileInfo });
```

บนฝั่ง Desktop ให้เก็บคำขอที่รอซิงก์ไว้แยกตามบัญชี Studio ส่งใหม่เมื่อได้ `503` หรือเกิดปัญหาเครือข่าย และหยุดรอให้ล็อกอินเมื่อได้ `401` ถ้าผู้ใช้สลับบัญชี ให้ส่งเฉพาะรายการของบัญชีใหม่ การส่งซ้ำใช้รหัสไฟล์เดิมในคลังเดิม

## ตรวจบน Production

ลงทะเบียน callback ที่ผู้ให้บริการ OAuth ตามช่องทางที่จะเปิดใช้

- Google: `https://pikpak-studio.vercel.app/api/auth/callback/google`
- LINE: `https://pikpak-studio.vercel.app/api/auth/callback/line`
- Facebook: `https://pikpak-studio.vercel.app/api/auth/callback/facebook`

หลัง migration และ deploy เสร็จ ให้ส่งหนึ่งโฟลเดอร์พร้อมไฟล์ตัวอย่างผ่าน WebView ตรวจว่า API ตอบ `200` พร้อม `synced` และรายการปรากฏในคลังของบัญชีเดียวกัน จากนั้นเปิดพรีวิวไฟล์ที่มีข้อมูล `file_info` และตรวจด้วยอีกบัญชีว่ามองไม่เห็นรายการของบัญชีแรก

ตอนนี้ API เก็บข้อมูลกำกับไฟล์ รูปตัวอย่าง และข้อมูลพรีวิวที่รองรับ ส่วนไฟล์ `.url` ยังต้องอ่านเนื้อหาไฟล์ต้นฉบับก่อนจึงจะทราบ URL ปลายทาง
