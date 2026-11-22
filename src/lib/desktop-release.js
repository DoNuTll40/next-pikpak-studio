export const DESKTOP_RELEASE = {
  version: "0.2.0",
  tag: "v0.2.0",
  platform: "Windows 10/11 (x64)",
  filename: "PikPak Studio_0.2.0_x64-setup.exe",
  sizeLabel: "3.56 MB",
  sizeBytes: 3729731,
  sha256: "d72a70cc5d277abf428f6ad04eba389026ecc05a6e45af81bb765a4c6408579a",
  releasedAt: "2026-11-22",
  downloadUrl:
    process.env.NEXT_PUBLIC_DESKTOP_DOWNLOAD_URL ||
    `/app/release/${encodeURIComponent("PikPak Studio_0.2.0_x64-setup.exe")}`,
  githubReleaseUrl:
    "https://github.com/DoNuTll40/next-pikpak-studio/releases/tag/v0.2.0",
  highlights: [
    "ล็อกอิน Cloud Sync ผ่านเบราว์เซอร์หลักของเครื่อง (PKCE S256 + Loopback)",
    "ระบบสแกนโฟลเดอร์ย่อยอัตโนมัติพร้อมตรวจสอบและรีเฟรชลิงก์ที่หมดอายุ",
    "ซิงก์คลัง สถานะสแกน และประวัติการรับชมขึ้น PikPak Studio Cloud แบบเรียลไทม์",
  ],
};
