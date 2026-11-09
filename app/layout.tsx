import type { Metadata } from "next";
import { ThemeProvider } from "next-themes";
import { siteDescription, siteLocale, siteName, siteUrl } from "~/lib/site";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "Mermaid Studio — Mermaid Diagram Editor & AI Generator",
    template: "%s | Mermaid Studio",
  },
  description: siteDescription,
  applicationName: siteName,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    siteName,
    locale: siteLocale,
    url: siteUrl,
    title: "Mermaid Studio — Mermaid Diagram Editor & AI Generator",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "Mermaid Studio — Mermaid Diagram Editor & AI Generator",
    description: siteDescription,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  category: "technology",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteName,
    url: siteUrl,
    description: siteDescription,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: "en",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    featureList: [
      "Mermaid editor with syntax highlighting",
      "Live diagram preview with pan and zoom",
      "SVG and PNG export",
      "AI generation from a plain-language description",
    ],
  };

  return (
    <html lang="en" suppressHydrationWarning>
      <body>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <script
            type="application/ld+json"
            // Structured data for rich results; content is a static literal
            // assembled from lib/site.ts, never user input.
            dangerouslySetInnerHTML={{
              __html: JSON.stringify(structuredData),
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
