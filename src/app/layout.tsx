import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Make My Marriage",
  description: "One collaborative workspace for planning your wedding.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">{children}</body>
    </html>
  );
}
