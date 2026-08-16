import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { cookies } from "next/headers";
import SiteFooter from "@/components/SiteFooter";
import { HTML_LANG, LOCALE_COOKIE, normalizeLocale } from "@/lib/i18n/config";
import { I18nProvider } from "@/lib/i18n/provider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Ruah — childcare matching for DC families",
  description:
    "Tell us what your family needs. Ruah reaches out to caregivers, follows up, and reports back — so you are not the one chasing replies.",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Resolved on the server so the first byte is already in the right language
  // and <html lang> is correct for screen readers and the browser's own
  // translate prompt. Reading cookies() opts this layout into dynamic
  // rendering, which it already needed — the locale differs per visitor.
  const locale = normalizeLocale((await cookies()).get(LOCALE_COOKIE)?.value);

  return (
    <html
      lang={HTML_LANG[locale]}
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <I18nProvider locale={locale}>
          {children}
          <SiteFooter />
        </I18nProvider>
      </body>
    </html>
  );
}
