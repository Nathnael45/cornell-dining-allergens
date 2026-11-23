import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible_Next } from "next/font/google";
import "./globals.css";

// Designed by the Braille Institute for legibility — right for quick reading on a phone in line.
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cornell dining, filtered",
  description: "See what you can eat in each Cornell dining hall, by allergen and diet.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f6f8f7" },
    { media: "(prefers-color-scheme: dark)", color: "#141b1e" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${atkinson.variable} antialiased`}>
      <body className="min-h-dvh bg-paper text-ink">
        <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-4">
          <header className="pt-5 pb-2">
            <Link href="/" className="text-[0.95rem] font-bold tracking-tight">
              <span className="text-carnelian">Cornell</span> dining, filtered
            </Link>
          </header>
          <main className="flex-1">{children}</main>
          <footer className="mt-12 border-t border-rule py-6 text-sm text-muted">
            <p className="max-w-prose">
              Allergen information here is estimated from menu names and Cornell&apos;s nutrition labels. It can be wrong, and recipes
              change. Always check the card at the station or ask staff. With a severe allergy, talk to Cornell Dining&apos;s dietitians:{" "}
              <a className="underline" href="mailto:diningnutrition@cornell.edu">
                diningnutrition@cornell.edu
              </a>
              .
            </p>
            <p className="mt-3">
              <Link className="underline" href="/status">
                Data status
              </Link>
            </p>
          </footer>
        </div>
      </body>
    </html>
  );
}
