import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
const kanit = localFont({
  src: [
    { path: "../../public/fonts/Kanit-Regular.ttf", weight: "400" },
    { path: "../../public/fonts/Kanit-Medium.ttf", weight: "500" },
    { path: "../../public/fonts/Kanit-SemiBold.ttf", weight: "600" },
    { path: "../../public/fonts/Kanit-Bold.ttf", weight: "700" },
  ],
  variable: "--font-kanit",
  display: "swap",
});
export const metadata: Metadata = {
  title: "Folio · SKU Performance",
  description: "Local-first SKU performance, BCG and year-over-year analysis.",
};
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={kanit.variable}>{children}</body>
    </html>
  );
}
