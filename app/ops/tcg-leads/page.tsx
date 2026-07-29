import Link from "next/link";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { hasOpsAccess } from "@/lib/opsAccess";
import { TCG_CARD_GAMES, TCG_LEAD_BUCKET, TCG_LEAD_STATUSES, makeReference, type TcgUploadedPhoto } from "@/lib/tcgMagnet";
import TcgLeadAdminControls from "@/components/TcgLeadAdminControls";

type SearchParams = {
  status?: string;
  province?: string;
  card_game?: string;
  q?: string;
  lead?: string;
};

export default async function TcgLeadsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await createServerClient();
  const { data } = await sb.auth.getUser();
  if (!hasOpsAccess(data?.user || null)) redirect("/staff-login");

  const params = await searchParams;
  const admin = getSupabaseAdmin();
  let query = (admin as any)
    .from("tcg_collection_leads")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(80);

  if (params.status && TCG_LEAD_STATUSES.includes(params.status as any)) query = query.eq("status", params.status);
  if (params.province) query = query.eq("province", params.province);
  if (params.card_game && TCG_CARD_GAMES.includes(params.card_game as any)) query = query.contains("card_games", [params.card_game]);
  if (params.q) {
    const q = params.q.replace(/[,%]/g, "").slice(0, 80);
    if (q) query = query.or(`full_name.ilike.%${q}%,email.ilike.%${q}%,phone.ilike.%${q}%`);
  }

  const { data: rows, error } = await query;
  const selectedLeadId = params.lead || rows?.[0]?.id || "";
  const selected = (rows || []).find((row: any) => row.id === selectedLeadId) || null;
  const notes = selectedLeadId
    ? await (admin as any)
        .from("tcg_collection_lead_notes")
        .select("id,created_at,note,actor_email")
        .eq("lead_id", selectedLeadId)
        .order("created_at", { ascending: false })
        .limit(20)
    : { data: [] as any[] };
  const signedPhotos = await getSignedPhotos(admin, selected?.photo_paths || []);

  return (
    <div className="w-full bg-slate-100 px-4 py-8 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-black">TCG Magnet Leads</h1>
            <p className="mt-1 text-sm text-slate-600">Review collection submissions, photos, status, offers, resale values, and follow-up notes.</p>
          </div>
          <Link className="rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold" href="/tcg-magnet">Public page</Link>
        </div>

        <form className="mb-5 grid gap-3 rounded-lg border border-slate-200 bg-white p-4 md:grid-cols-5">
          <select name="status" defaultValue={params.status || ""} className={filterClass}>
            <option value="">All statuses</option>
            {TCG_LEAD_STATUSES.map((status) => <option key={status}>{status}</option>)}
          </select>
          <input name="province" defaultValue={params.province || ""} placeholder="Province" className={filterClass} />
          <select name="card_game" defaultValue={params.card_game || ""} className={filterClass}>
            <option value="">All card games</option>
            {TCG_CARD_GAMES.map((game) => <option key={game}>{game}</option>)}
          </select>
          <input name="q" defaultValue={params.q || ""} placeholder="Name, email, or phone" className={filterClass} />
          <button className="min-h-10 rounded-md bg-slate-950 px-4 text-sm font-bold text-white">Filter</button>
        </form>

        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-4 text-red-700">{error.message}</div> : null}

        <div className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
            {(rows || []).map((row: any) => {
              const active = row.id === selectedLeadId;
              return (
                <Link key={row.id} href={`/ops/tcg-leads?lead=${row.id}`} className={`block border-b border-slate-100 p-4 ${active ? "bg-teal-50" : "bg-white hover:bg-slate-50"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-black">{row.full_name}</div>
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{row.status}</span>
                  </div>
                  <div className="mt-1 text-sm text-slate-600">{row.email} | {row.phone}</div>
                  <div className="mt-1 text-xs text-slate-500">{row.city}, {row.province} | {(row.card_games || []).join(", ")}</div>
                </Link>
              );
            })}
            {!rows?.length ? <div className="p-5 text-sm text-slate-600">No TCG leads match the current filters.</div> : null}
          </div>

          {selected ? (
            <div className="grid gap-5">
              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-mono text-sm font-bold text-slate-500">{makeReference(selected.id)}</div>
                    <h2 className="mt-1 text-2xl font-black">{selected.full_name}</h2>
                    <p className="mt-1 text-slate-600">{selected.email} | {selected.phone} | {selected.city}, {selected.province}</p>
                  </div>
                  <span className="rounded-full bg-teal-100 px-3 py-1 text-sm font-black text-teal-900">{selected.status}</span>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <Detail label="Card games" value={(selected.card_games || []).join(", ")} />
                  <Detail label="Collection types" value={(selected.collection_types || []).join(", ")} />
                  <Detail label="Approx. count" value={selected.approximate_card_count} />
                  <Detail label="Estimated value" value={selected.estimated_value || "Not provided"} />
                  <Detail label="Timeline" value={selected.selling_timeline} />
                  <Detail label="Willing to ship" value={selected.willing_to_ship} />
                </div>
                <LongDetail label="Important items" value={selected.important_items} />
                <LongDetail label="Condition notes" value={selected.condition_notes || "Not provided"} />
                <LongDetail label="Additional details" value={selected.additional_details || "Not provided"} />
                <div className="mt-5 grid gap-3 text-xs text-slate-500 sm:grid-cols-2">
                  <Detail label="Source" value={[selected.source, selected.medium, selected.campaign].filter(Boolean).join(" / ") || "Not captured"} />
                  <Detail label="GCLID" value={selected.gclid || "Not captured"} />
                  <Detail label="Landing page" value={selected.landing_page || "Not captured"} />
                  <Detail label="Referrer" value={selected.referrer || "Not captured"} />
                </div>
              </section>

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-lg font-black">Uploaded photos</h3>
                {signedPhotos.length ? (
                  <div className="grid gap-3 sm:grid-cols-3">
                    {signedPhotos.map((photo) => (
                      <a key={photo.path} href={photo.url} target="_blank" rel="noreferrer" className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={photo.originalName} className="h-36 w-full object-cover" />
                        <div className="truncate p-2 text-xs font-semibold">{photo.originalName}</div>
                      </a>
                    ))}
                  </div>
                ) : <p className="text-sm text-slate-600">No signed photo previews available.</p>}
              </section>

              <TcgLeadAdminControls leadId={selected.id} initialStatus={selected.status} initialValues={selected} />

              <section className="rounded-lg border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-lg font-black">Internal notes</h3>
                {(notes.data || []).map((note: any) => (
                  <div key={note.id} className="border-b border-slate-100 py-3 text-sm">
                    <div className="text-xs font-bold text-slate-500">{new Date(note.created_at).toLocaleString()} | {note.actor_email || "Ops"}</div>
                    <p className="mt-1 whitespace-pre-wrap">{note.note}</p>
                  </div>
                ))}
                {!notes.data?.length ? <p className="text-sm text-slate-600">No notes yet.</p> : null}
              </section>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

async function getSignedPhotos(admin: any, photos: TcgUploadedPhoto[]) {
  const result = [];
  for (const photo of photos || []) {
    if (photo?.bucket !== TCG_LEAD_BUCKET || !photo?.path) continue;
    const signed = await admin.storage.from(TCG_LEAD_BUCKET).createSignedUrl(photo.path, 60 * 10);
    if (!signed.error && signed.data?.signedUrl) {
      result.push({ ...photo, url: signed.data.signedUrl });
    }
  }
  return result;
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-slate-50 p-3">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold">{value}</div>
    </div>
  );
}

function LongDetail({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-5">
      <div className="text-xs font-bold uppercase tracking-wide text-slate-500">{label}</div>
      <p className="mt-1 whitespace-pre-wrap rounded-md bg-slate-50 p-3 text-sm leading-6">{value}</p>
    </div>
  );
}

const filterClass = "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200";
