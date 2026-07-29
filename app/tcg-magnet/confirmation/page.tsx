import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Collection Received | TCG Magnet",
  robots: { index: false, follow: false },
};

export default async function TcgMagnetConfirmationPage({
  searchParams,
}: {
  searchParams: Promise<{ ref?: string }>;
}) {
  const params = await searchParams;
  const reference = String(params?.ref || "").trim();

  return (
    <div className="w-full bg-[#030507] px-4 py-16 text-slate-100 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-3xl rounded-lg border border-[#2b8dff]/30 bg-[#f8fbff] p-8 text-slate-950 shadow-2xl">
        <img src="/tcg-magnet-logo.png" alt="TCG Magnet" className="mb-5 w-44" />
        <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#1f6fbd]">Collection received</p>
        <h1 className="mt-3 text-3xl font-black">Your collection submission was received.</h1>
        <p className="mt-4 leading-7 text-slate-700">
          The TCG Magnet team will review the collection details and photos. Watch for contact by email, phone, or text.
        </p>
        {reference ? (
          <div className="mt-6 rounded-md border border-slate-200 bg-slate-50 p-4">
            <div className="text-sm font-bold text-slate-600">Submission reference</div>
            <div className="mt-1 font-mono text-lg font-black">{reference}</div>
          </div>
        ) : null}
        <Link href="/tcg-magnet" className="mt-7 inline-flex min-h-11 items-center rounded-md bg-[#07111d] px-5 font-bold text-white">
          Back to TCG Magnet
        </Link>
      </section>
    </div>
  );
}
