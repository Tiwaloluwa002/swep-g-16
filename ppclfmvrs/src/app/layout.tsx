import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "OAU Lost & Found · Verified recovery",
  description:
    "Privacy-Preserving Campus Lost-and-Found Matching and Verified Recovery System for Obafemi Awolowo University, Ile-Ife.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
        >
          Skip to main content
        </a>
        <SiteHeader />
        {children}
        <footer className="mt-auto border-t border-border px-4 py-4 text-center text-sm text-muted">
          SWEP Group 15 · Obafemi Awolowo University, Ile-Ife · No photos, no phone numbers, no public names.
        </footer>
      </body>
    </html>
  );
}
