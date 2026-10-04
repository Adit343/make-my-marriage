import type { Metadata } from "next";
import { Newsreader, Plus_Jakarta_Sans } from "next/font/google";
import { MATERIAL_SYMBOLS_STYLESHEET } from "@/components/ui/icon";
import { ToastProvider } from "@/components/ui/toast";
import "./globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  axes: ["opsz"],
  variable: "--font-newsreader",
});

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
});

export const metadata: Metadata = {
  title: "Make My Marriage — Collaborative Wedding Planning for Indian Weddings",
  description:
    "One shared workspace for couples, families and planners to plan the wedding together — guests, budget, tasks and memories in one place.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${newsreader.variable} ${jakarta.variable} scroll-smooth`}>
      <head>
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS_STYLESHEET} />
      </head>
      {/* Pages set their own text size: some Stitch screens size body text, others don't. */}
      <body className="bg-background font-body-md text-on-surface antialiased">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
