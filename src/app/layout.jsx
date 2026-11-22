import "@fontsource-variable/noto-sans";
import "@fontsource-variable/noto-sans-thai-looped";
import "@fontsource-variable/noto-sans-sc";
import "@fontsource-variable/noto-sans-tc";
import "@fontsource-variable/noto-sans-jp";
import "@fontsource-variable/noto-sans-kr";
import "@fontsource-variable/noto-sans-arabic";
import "@fontsource-variable/noto-sans-hebrew";
import "@fontsource-variable/noto-sans-devanagari";
import "@fontsource-variable/noto-sans-bengali";
import "@fontsource-variable/noto-sans-khmer";
import "@fontsource-variable/noto-sans-lao";
import "@fontsource-variable/noto-sans-myanmar";
import "./globals.css";

export const metadata = {
  title: "PikPak Studio",
  description: "คลังส่วนตัวของ PikPak Studio",
  icons: { icon: "/studio.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="th" className="scheme-dark data-[theme=light]:scheme-light
        [--background:#111522] data-[theme=light]:[--background:#f3f6fc]
        [--panel:#1b2232] data-[theme=light]:[--panel:#ffffff]
        [--field:#151b29] data-[theme=light]:[--field:#f6f8fc]
        [--border:#344057] data-[theme=light]:[--border:#dce4f0]
        [--foreground:#edf2ff] data-[theme=light]:[--foreground:#17233b]
        [--muted:#a7b5ce] data-[theme=light]:[--muted:#586780]
        [--accent-text:#a9bfff] data-[theme=light]:[--accent-text:#204abc]
        [--success:#72dfb3] data-[theme=light]:[--success:#116648]
        [--warning:#f7c679] data-[theme=light]:[--warning:#855109]
        [--art:#263449] data-[theme=light]:[--art:#e0e9f7]">
      <body className="bg-background font-sans text-foreground [&_:lang(zh-Hant)]:font-zh-hant
        [&_:focus-visible]:outline-2 [&_:focus-visible]:outline-offset-3 [&_:focus-visible]:outline-accent-text
        [&_button]:cursor-pointer [&_select]:cursor-pointer [&_summary]:cursor-pointer
        motion-safe:[&_a]:transition-colors motion-safe:[&_button]:transition-colors">
        {children}
      </body>
    </html>
  );
}

