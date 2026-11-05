import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "このポケだーれ?",
  description: "10 個のヒントで当てる、1 日 1 回の非公式ファンゲーム",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ja" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
