import type { Metadata } from "next";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import { SettingsEffect } from "@/components/settings-effect";
import "./globals.css";

// Atkinson Hyperlegible was designed by the Braille Institute for low-vision readers.
const atkinson = Atkinson_Hyperlegible_Next({
  variable: "--font-atkinson",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AACNRAS · OAU Accessible Campus Navigation",
  description:
    "Accessibility-Aware Campus Navigation and Route Advisory System for Obafemi Awolowo University, Ile-Ife.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">
        <a
          href="#main"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[2000] focus:rounded focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-fg"
        >
          Skip to main content
        </a>
        <SettingsEffect />
        {children}
      </body>
    </html>
  );
}
