import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";

import "./globals.css";

export const metadata: Metadata = {
  title: "爱豆匹配测试",
  description: "娱乐向爱豆匹配测试，支持15题体验版和40题专业版，根据偏好标签和候选画像给出可解释推荐。"
};

export const viewport: Viewport = {
  themeColor: "#fff7ed"
};

export default function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
