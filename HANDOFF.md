# PikPak Studio Web + Desktop handoff

## 1. เป้าหมายและข้อกำหนดของผู้ใช้

- ใช้ Vercel **Production** เป็นปลายทางสำหรับ Desktop ผู้ใช้ยืนยันว่าไม่เอา Vercel Preview เป็นปลายทางและไม่ต้องการให้ Desktop ยิง localhost
- ใช้ Neon ฐานจริงเดิม `pikpak_studio` ให้ Desktop ส่ง catalog, เนื้อหาที่จำเป็นจาก `detail` และ `file_info` เข้าเว็บ แล้วให้เว็บอ่านข้อมูลจากฐานตามบัญชีที่ล็อกอิน
- ห้ามลบข้อมูลเดิม ห้าม reset ฐานหรือแทนข้อมูลทั้งหมดด้วย snapshot จาก Desktop การซิงก์เพิ่มหรืออัปเดตเฉพาะรายการที่ส่งมา
- Google, LINE และ Facebook เป็นช่องทางสมัคร/ล็อกอินได้ตามการตั้งค่า แต่ละบัญชีมีคลังและประวัติของตัวเอง ผู้ใช้ยืนยันว่าบัญชี Google เจ้าของล็อกอินได้บนเครื่องแล้ว ส่วน LINE เคยยืนยันว่าบัญชีแยกเห็นคลังว่าง การล็อกอินทั้งสามบน Production ยังไม่มีผลทดสอบ
- ผู้ใช้ต้องการลดค่าคงที่เกี่ยวกับเจ้าของและแชร์หลักใน env ให้ฐานเป็นแหล่งข้อมูลจริง คงความสัมพันธ์กับคลังเดิมไว้ระหว่างย้าย และตรวจข้อมูลก่อนถอดค่าที่ใช้อยู่

## 2. Workspace และข้อควรระวัง

| งาน | ตำแหน่ง |
| --- | --- |
| Web Next.js | `D:\Downloads\next-pikpak` |
| Desktop Tauri | `D:\Downloads\tauri-pikpak` |
| คู่มือ Desktop | `D:\Downloads\next-pikpak\DESKTOP-SYNC.md` |
| การตั้งค่าและสัญญา API | `D:\Downloads\next-pikpak\README.md` |

Web ใช้ Next.js 16.4.6, JSX, Tailwind, Better Auth แบบ self-managed และ `pg` อ่าน AGENTS.md แล้วอ่าน guide ของ Next ที่ติดตั้งจริงใต้ `node_modules/next/dist/docs/` ก่อนเขียนโค้ด Repo มีไฟล์ modified/untracked จำนวนมากจากงานเดิม และไม่มี Git remote ที่แสดงในรอบล่าสุด อย่า reset หรือทับงานของผู้ใช้ ตัว CLI ถูก link กับโปรเจกต์ Vercel แล้ว ส่วน Desktop อยู่นอก writable root ของรอบนี้และยังไม่ได้แก้ source

ค่าใน `.env.local` เป็นข้อมูลลับ แสดงเฉพาะชื่อตัวแปร เก็บไฟล์ไว้นอก Git และ deploy bundle ตาม `.gitignore` กับ `.vercelignore` การ link Vercel อัปเดต `.gitignore` และเพิ่ม token สำหรับ CLI ใน env local ค่าเชื่อมฐานและ Google ที่มีอยู่ผ่านการตรวจว่าคงอยู่โดยตรวจเพียงว่ามีค่า

## 3. สถานะจริง ณ ส่งต่อ

| ส่วน | สถานะ |
| --- | --- |
| API `POST /api/desktop/sync` | เขียนโค้ดแล้ว ตรวจ syntax ของไฟล์ JS ที่เกี่ยวข้องแล้ว ยังไม่ได้ยิงจริงจาก Desktop |
| Neon migration 003 | ทดสอบบน branch แยกสำเร็จ แล้วรันบน Production สำเร็จ ตรวจพบคอลัมน์ทั้ง 4 ตัว |
| Vercel project | สร้างและ link `donuts-projects/pikpak-studio` แล้ว |
| Vercel env | ตั้ง `BETTER_AUTH_URL=https://pikpak-studio.vercel.app` ใน Production แล้ว ส่วน connection strings และ OAuth secrets ยังไม่ได้ส่ง |
| Vercel deployment | ยังไม่ได้ build หรือ deploy Production และยังไม่ได้ยืนยันว่าโดเมนตอบจริง |
| Desktop integration | มีคู่มือและตัวอย่าง request ยังไม่ได้แก้แอปให้ส่งข้อมูลจริง |
| Production OAuth | ยังไม่ได้ตั้งหรือยืนยัน callback ใน dashboard ของ Google, LINE, Facebook |

### พิกัดระบบ

- Neon โปรเจกต์ `rough-feather-80177272` ฐาน `pikpak_studio` สาขา Production `br-calm-breeze-azikcxm9`
- Branch ทดสอบ migration ชื่อ `desktop-sync-migration-check` ID `br-calm-hill-az8xjzmc` ยังอยู่ เป็น branch ปกติในโปรเจกต์เดิม เพราะ Neon ตอบว่า schema-only ใช้ไม่ได้กับ legacy role `studio_catalog_access` อย่าลบ branch ใดโดยไม่มีการยืนยัน Check database target ทุกครั้งก่อน mutation
- Vercel scope `donuts-projects` โปรเจกต์ `pikpak-studio` ID `prj_oRNEGa9jef5hhVqGNEdD7U8pvDAk` โดเมนที่ตั้งใจใช้ `https://pikpak-studio.vercel.app` ตรวจ alias หลัง deploy
- `vercel.json` กำหนด framework เป็น `nextjs` เพราะตอนสร้างโปรเจกต์เปล่า preset แสดงเป็น Other

## 4. Auth, role และ env

- `DATABASE_URL` ใช้กับคลัง และเป็น connection ของ API ซิงก์ Migration 003 เพิ่ม INSERT/UPDATE เฉพาะ `studio.catalog_items` ให้ `pikpak_web_reader` ภายใต้ RLS เดิม
- `AUTH_DATABASE_URL` ใช้ role เดิม `pikpak_auth_runtime` บน Neon **ฐานเดียวกัน** ตรวจแล้วว่า role นี้เข้าถึงตาราง Better Auth ทั้งสี่ แต่ไม่มีสิทธิ์อ่านตารางคลัง ใช้ connection นี้คืนความสามารถล็อกอินแล้ว
- อย่าแก้ปัญหาด้วยการชี้ runtime ไปที่ `neondb_owner` สิทธิ์ owner กว้างกว่า role ที่แอปใช้แยกคลัง ผู้ใช้เคยอยากใช้ URL เดียว แต่เมื่อเอา `AUTH_DATABASE_URL` ออก ปุ่ม OAuth กดได้แล้วล้มเหลว เพราะ role ของคลังเข้า auth tables ไม่ได้ การเพิ่ม CRUD ของ auth ให้ role เว็บเคยถูก auto-review ปฏิเสธ จึงคงสอง URL เข้าฐานเดียวกันไว้
- `BETTER_AUTH_SECRET` ใช้กับระบบ auth ส่วน `BETTER_AUTH_URL` เป็น origin ของ deployment
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `LINE_CLIENT_ID`, `LINE_CLIENT_SECRET`, `FACEBOOK_CLIENT_ID`, `FACEBOOK_CLIENT_SECRET` ใช้เปิด provider ตามคู่ที่มีค่า
- `STUDIO_ACCESS_KEY` ถูกลบออกจาก `.env.local` แล้ว ช่องล็อกอินด้วยคีย์ไม่แสดงเมื่อ env นี้ไม่มีค่า เส้นทาง legacy ในโค้ดยังอยู่
- `STUDIO_OWNER_EMAIL` ใช้ตอนสร้างบัญชี Google ที่ยืนยันเมลแล้วเพื่อผูกคลังเก่า `STUDIO_OWNER_ID` ใช้กับสิทธิ์อ่านแคช Windows เฉพาะคลังเดิมและการผูกคลังครั้งแรก `STUDIO_SHARE_ROOT_IDS` เป็น fallback จัดหมวดแชร์หลักสำหรับข้อมูลเก่า ถอดหลังตรวจ mapping และ backfill จากข้อมูล Desktop จริง
- ตาราง Better Auth อยู่ใน `public.studio_auth_user`, `public.studio_auth_account`, `public.studio_auth_session`, `public.studio_auth_verification` ดู migrations 001–002 ซึ่งลงไว้ก่อนแล้ว Trigger จัดหา `studio.users` และเก็บ UUID ใน `studioOwnerId` ของบัญชี Better Auth ปกติ userid ของคลังมาจากค่านี้ `studio.oauth_identities` เป็นส่วนของ schema เก่าและไม่ใช่หลักฐานว่า Better Auth สมัครสำเร็จ
- Google เจ้าของที่ผู้ใช้ระบุคือ `iinter731@gmail.com` ตรวจ mapping จากฐานก่อนถอดค่า owner ห้ามสลับคลังของ LINE หรือ Facebook ไปเข้าคลังเจ้าของโดยอัตโนมัติ

## 5. API และเส้นทางข้อมูล

- `src/app/api/desktop/sync/route.js` รับ JSON ด้วย POST เฉพาะ Origin ที่ตรง `BETTER_AUTH_URL` และต้องมี session Better Auth ที่ใช้ได้ ใช้ `session.user.studioOwnerId` เป็นเจ้าของ ตรวจ UUID และจำกัด body 512 KiB อ่านจาก stream จึงบังคับขนาดได้แม้ไม่มี Content-Length
- `src/lib/server/desktop-sync.js` รองรับ `catalog`, `detail.files` หรือ `detail.data.files` พร้อม `file_info` แบบ object หรือ array รวมสูงสุด 100 records รายการใช้ `id`, `name`, `kind` และรองรับค่า kind แบบ `drive#file` / `drive#folder` บันทึก parent, MIME, size, modified time, thumbnail และแชร์หลักเมื่อ Desktop ระบุ
- ใช้ transaction พร้อม `set_config('studio.user_id', userId, true)` และ parameterized SQL อัปเซิร์ตตาม `(user_id, file_id)` โดยคงค่าหลายส่วนที่ batch ถัดไปละไว้ และมี guard สำหรับ source timestamp ที่เก่ากว่า ไม่มีคำสั่งลบใน sync
- `database/003_desktop_sync.sql` เพิ่ม `detail jsonb`, `file_info jsonb`, `thumbnail_url text`, `share_root boolean` ไม่ต้องรัน migration 001–002 ซ้ำบน Production
- `detail` และ `file_info` เก็บเฉพาะฟิลด์ที่โค้ดเลือกและจัดรูปแบบ เช่น metadata และ preview จาก `file_info` โดยละ pagination/passcode token และไม่ fetch URL จาก payload
- `src/lib/server/catalog.js` อ่าน thumbnail จากฐาน รวมรูปจากไฟล์ลูกเมื่อไม่มีรูปโฟลเดอร์ `src/components/CatalogPage.jsx` อ่าน `share_root` และยังมี fallback ของคลังเก่า `src/app/api/media/[id]/route.js` อ่าน `file_info.preview` ก่อนแคชเดิม Preview จำกัดลิงก์ที่ตัว parser รองรับและลิงก์จากต้นทางอาจหมดอายุ
- `studio.scan_folders` กับ `studio.watch_history` ยังมีเส้นทางเดิม API ใหม่ไม่รับสถานะสแกนหรือสร้างประวัติดูไฟล์จากการซิงก์ `hasInfo` บนการ์ดอาจอิง `file_info` หรือประวัติเดิม รายการ history ใน Production ยังไม่ได้ย้ายรูปทั้งหมดมาใช้ข้อมูลใหม่
- ไฟล์ `.url` มีไอคอนทางลัดของตัวเอง การเปิดยังเข้ากล่องชนิดไฟล์ไม่รองรับ แถวที่ตรวจมี MIME text/plain และขนาด 125 ไบต์ แต่ไม่มีเนื้อไฟล์หรือ `URL=` ในฐานหรือแคชที่ตรวจ ต้องออกแบบอ่านเนื้อไฟล์จากต้นทางแยก ถ้าอยู่ในขอบเขตงานถัดไป

## 6. Desktop sources และวิธีต่อ

- `tauri-pikpak/database/import-desktop.mjs` อ่านแคช `share-detail` และ `file_info` แล้ว import ข้อมูลรายการกับประวัติบางส่วนลง Neon ตัวเก่าระบุเจ้าของตามอีเมลและไม่ได้เก็บ preview payload ทั้งหมด
- `tauri-pikpak/database/scan-server.mjs` เขียน `studio.scan_folders` โดยอิง owner คงที่และเป็นคนละเส้นทางกับ API ใหม่
- จุดสำรวจต่อคือ `tauri-pikpak/src-tauri/src/browser_video_info.js` ที่ invoke `save_browser_video_info` และ `tauri-pikpak/src-tauri/src/browser.rs` ในฟังก์ชัน `save_browser_video_info` กับส่วนที่บันทึก `share-detail` จาก response `detail`
- `detail` ที่เห็นใน DevTools มี `files[]`, `next_page_token`, `pass_code_token` และ `share_status` ให้ Desktop จัดการ pagination กับ access token ของ PikPak เอง ส่งเฉพาะหน้าไฟล์ที่ต้องซิงก์ ข้อมูล `file_info` มาจากจุด capture อีกจุด
- ใช้ WebView เฉพาะ Studio เปิดโดเมน Production ให้ผู้ใช้ล็อกอินแล้วส่งคำขอแบบ same-origin เพื่อใช้ cookie ใน WebView เดิม อย่าส่ง credential ของ Studio ไปหน้า PikPak ใช้ bridge ที่ตรวจ origin ส่งเฉพาะ metadata และทำคิวแยกตามบัญชี ตรวจบัญชีปัจจุบันก่อน flush คิว โดยเฉพาะหลังสลับบัญชี
- วิธีเรียก sample อยู่ใน `DESKTOP-SYNC.md` ใช้ POST JSON รับ `{ "synced": n }` เมื่อสำเร็จ จัดการ 401 ให้ล็อกอินใหม่ 400 ให้ทบทวน payload 413 ให้แบ่ง batch และ 503 ให้ retry แบบมี backoff

## 7. ลำดับงานถัดไป

1. **ปลดบล็อก env Production** ระบบ auto-review เคยปฏิเสธการส่ง Neon connection strings, OAuth secrets และ Better Auth secret จาก `.env.local` ไปยัง Vercel ไม่พบว่าคำสั่งนั้นอัปโหลดค่าใดสำเร็จ ขออนุมัติแบบเจาะจงปลายทาง `donuts-projects/pikpak-studio` และประเภท secret หรือให้ผู้ใช้ตั้งค่าเองใน Vercel dashboard อย่าส่งค่าผ่านแชตหรือใช้ช่องทางอ้อมเลี่ยงผลตรวจ ตรวจเฉพาะรายชื่อ env กับ scope หลังตั้งค่า
2. **ตั้ง OAuth บนโดเมนจริง** ลงทะเบียน `https://pikpak-studio.vercel.app/api/auth/callback/google`, `/api/auth/callback/line` และ `/api/auth/callback/facebook` ตาม provider ที่เปิดใช้ เก็บ callback localhost ของ dev ไว้ถ้าผู้ให้บริการรองรับหลาย URI
3. **ตรวจ build และ deploy Production** จาก workspace ที่ link แล้ว ตรวจไฟล์ env ไม่ถูก upload เป็น source ตรวจ build log โดยไม่พิมพ์ secrets และยืนยัน Production alias ผู้ใช้ไม่ต้องการ Vercel Preview
4. **ตรวจ API ก่อนเชื่อม Tauri จริง** เรียกหนึ่งชุดจากเซสชันบน Production ตรวจว่า 200 และอ่านข้อมูลจาก Neon ได้ ตรวจซ้ำด้วย batch เดิมว่าไม่เกิดรายการซ้ำ ทดสอบ payload ผิดและคำขอไม่มีเซสชัน ตรวจอีกบัญชีว่าไม่เห็นไฟล์ รูป หรือพรีวิวของบัญชีแรก ตรวจกรณี source timestamp เก่า การละฟิลด์ และ `file_info` มาหลัง catalog
5. **ต่อ Desktop** ขอสิทธิ์เขียนใน workspace `tauri-pikpak` ถ้ายังถูกจำกัด ติดตั้งจุดส่งจาก capture `detail` / `file_info` ผ่าน Studio WebView ที่ล็อกอินแล้ว ตรวจการ retry และ account switch และใช้ Production URL เท่านั้น
6. **Backfill แบบเพิ่ม/อัปเดต** ส่งข้อมูลที่มีใน Desktop cache เข้า Neon ผ่านบัญชีที่ถูกต้อง ค่อยเทียบโฟลเดอร์ แชร์หลัก รูป และพรีวิวกับของเดิม รักษารายการเดิมและตรวจลิงก์หมดอายุ ถ้าต้องการ metadata เพิ่มให้ตกลงรายชื่อฟิลด์ก่อนส่ง
7. **ถอดค่าคงที่เมื่อฐานพร้อม** ตรวจว่า Google เจ้าของผูกคลังเดิมและ root flags ถูกส่งครบแล้ว จึงค่อยถอด `STUDIO_OWNER_EMAIL`, `STUDIO_OWNER_ID`, `STUDIO_SHARE_ROOT_IDS` และแคช fallback ตามส่วนที่ย้ายเสร็จจริง

ยังไม่ควรเรียกงานว่าใช้งานได้ครบวงจรจนกว่าจะเห็นการล็อกอินและซิงก์จาก Desktop บน Production แล้วข้อมูลปรากฏในคลังของบัญชีเดียวกันจริง
