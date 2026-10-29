import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: "EASpaze — สร้าง Strategy โดยไม่ต้องเขียนโค้ด",
  description:
    "เปลี่ยนไอเดียการเทรดให้เป็นกลยุทธ์ที่จับต้องได้ ทดลอง และแบ่งปันไปพร้อมชุมชน EASpaze",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
