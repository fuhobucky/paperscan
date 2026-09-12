import type { Metadata, Viewport } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "PaperScan Studio — Quét tài liệu",
  description: "Quét, cắt phối cảnh, nhận diện văn bản và xuất PDF ngay trên thiết bị của bạn.",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "PaperScan" },
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg", apple: "/icons/apple-touch-icon.png" },
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#087f63" };
export default function RootLayout({children}: Readonly<{children: React.ReactNode}>) {
 return <html lang="vi" suppressHydrationWarning><body className="antialiased">{children}</body></html>;
}
