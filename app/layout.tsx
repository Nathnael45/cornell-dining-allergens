import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Atkinson_Hyperlegible_Next, Bricolage_Grotesque } from "next/font/google";
import { FirstRun } from "@/components/restrictions";
import "./globals.css";

// Body: designed by the Braille Institute for legibility (quick reading in line, on a phone).
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin"] });
// Display: hall names, the restriction sentence, counts.
const bricolage = Bricolage_Grotesque({ variable: "--font-bricolage", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Cornell dining, filtered",
  description: "See what you can eat in each Cornell dining hall, by allergen and diet.",
  // Home-screen app on iPhone: full screen, red header runs under the status bar.
  appleWebApp: { capable: true, title: "Dining", statusBarStyle: "black-translucent" },
};

export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#b31b1b" },
    { media: "(prefers-color-scheme: dark)", color: "#8c1616" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: the script below may add data-firstrun before React hydrates.
    <html lang="en" className={`${atkinson.variable} ${bricolage.variable} antialiased`} suppressHydrationWarning>
      <head>
        {/* Runs before paint so a first-time visitor never sees the menu before choosing. Key must match components/prefs.ts. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{localStorage.getItem("dining-prefs-v1")===null&&document.documentElement.setAttribute("data-firstrun","")}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-dvh bg-paper text-ink">
        <FirstRun />
        <main>{children}</main>
        <footer className="mx-auto max-w-6xl px-4 pt-10 pb-12 text-[0.9rem] text-muted lg:pl-[21rem]">
          <p className="max-w-prose">
            Allergen information here is estimated from menu names and Cornell&apos;s nutrition labels. It can be wrong, and recipes
            change. Always check the card at the station or ask staff. With a severe allergy, talk to Cornell Dining&apos;s dietitians at{" "}
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
      </body>
    </html>
  );
}

