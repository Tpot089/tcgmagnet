import type { Metadata } from "next";
import { Suspense } from "react";
import TcgMagnetLanding from "@/components/TcgMagnetLanding";

export const metadata: Metadata = {
  title: "Sell Your Trading Card Collection | TCG Magnet",
  description:
    "TCG Magnet purchases trading-card collections, graded cards, sealed products, binders, and high-value singles from sellers across Canada.",
  alternates: { canonical: "/tcg-magnet" },
  openGraph: {
    title: "Sell Your Trading Card Collection | TCG Magnet",
    description:
      "Submit photos and collection details online to receive a direct offer for Pokemon, Magic, Yu-Gi-Oh!, Dragon Ball Super, One Piece, sports cards, and more.",
    url: "/tcg-magnet",
    siteName: "TCG Magnet",
    locale: "en_CA",
    type: "website",
  },
};

export default function TcgMagnetPage() {
  return (
    <Suspense fallback={null}>
      <TcgMagnetLanding />
    </Suspense>
  );
}
