import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL || "https://tcgmagnet.ca"),
  title: {
    default: "TCG Magnet | Sell Your Trading Card Collection",
    template: "%s | TCG Magnet",
  },
  description:
    "TCG Magnet purchases trading-card collections, graded cards, sealed products, binders, and high-value singles from sellers across Canada.",
  openGraph: {
    type: "website",
    siteName: "TCG Magnet",
    title: "TCG Magnet | Sell Your Trading Card Collection",
    description:
      "Submit photos and collection details online to receive a direct offer for trading-card collections.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const googleAdsId = process.env.NEXT_PUBLIC_GOOGLE_ADS_ID;

  return (
    <html lang="en">
      <head>
        {googleAdsId ? (
          <>
            <Script async src={`https://www.googletagmanager.com/gtag/js?id=${googleAdsId}`} strategy="afterInteractive" />
            <Script
              id="google-ads-gtag"
              strategy="afterInteractive"
              dangerouslySetInnerHTML={{
                __html: `
window.dataLayer = window.dataLayer || [];
function gtag(){dataLayer.push(arguments);}
gtag('js', new Date());
gtag('config', '${googleAdsId}');
                `.trim(),
              }}
            />
          </>
        ) : null}
      </head>
      <body>
        <main className="min-h-screen w-full">{children}</main>
      </body>
    </html>
  );
}
