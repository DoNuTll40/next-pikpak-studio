"use client";

import { control, empty, subtitle } from "@/lib/ui-styles";
import { useRouter } from "next/navigation";
import { StudioPage } from "@/components/StudioContent";

export default function StudioError() {
  const router = useRouter();
  return (
    <StudioPage>
      <section className={`${empty} mt-4`}>
        <h2 className={subtitle}>โหลดข้อมูลคลังไม่ได้</h2>
        <button className={control} onClick={() => router.refresh()}>ลองอีกครั้ง</button>
      </section>
    </StudioPage>
  );
}
