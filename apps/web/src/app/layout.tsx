import type { Metadata } from "next";
import { Bricolage_Grotesque, DM_Mono, Hanken_Grotesk } from "next/font/google";
import { AppShell } from "@/components/shell/app-shell";
import "./globals.css";

/** Headings and large figures */
const display = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });
/** Interface text */
const sans = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });
/** Numbers, XP, units */
const mono = DM_Mono({ variable: "--font-dm-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: "LIFEOS",
  description: "Personal command center for progress across study, training, recovery and skills.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" data-theme="dark" className={`${display.variable} ${sans.variable} ${mono.variable} antialiased`}>
      <body className="min-h-dvh">
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
