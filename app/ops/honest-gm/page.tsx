import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import { hasOpsAccess } from "@/lib/opsAccess";

export const dynamic = "force-dynamic";

type SearchParams = { campaign?: string; created?: string; error?: string };

async function createCampaign(formData: FormData) {
  "use server";
  const sb = await createServerClient();
  const { data } = await sb.auth.getUser();
  const user = data?.user || null;
  if (!hasOpsAccess(user)) redirect("/staff-login");

  const name = String(formData.get("name") || "").trim().slice(0, 120);
  const characterName = String(formData.get("character_name") || "").trim().slice(0, 120) || null;
  const pastedPremise = String(formData.get("premise") || "").trim();
  const premiseFile = formData.get("premise_file");
  let premise = pastedPremise;

  if (premiseFile instanceof File && premiseFile.size > 0) {
    if (premiseFile.size > 500_000) redirect("/ops/honest-gm?error=Premise%20file%20is%20too%20large");
    premise = (await premiseFile.text()).trim();
  }

  if (!name || !premise) redirect("/ops/honest-gm?error=Campaign%20name%20and%20premise%20are%20required");
  if (premise.length > 250_000) redirect("/ops/honest-gm?error=Premise%20must%20be%20250%2C000%20characters%20or%20less");

  let characterState: Record<string, unknown> = {};
  const rawState = String(formData.get("character_state") || "").trim();
  if (rawState) {
    try {
      const parsed = JSON.parse(rawState);
      if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") throw new Error("State must be an object");
      characterState = parsed;
    } catch {
      redirect("/ops/honest-gm?error=Character%20state%20must%20be%20valid%20JSON");
    }
  }

  const { data: campaign, error } = await (sb as any)
    .from("honest_gm_campaigns")
    .insert({
      created_by: user?.id || null,
      name,
      premise,
      character_name: characterName,
      character_state: characterState,
    })
    .select("id")
    .single();

  if (error || !campaign) redirect(`/ops/honest-gm?error=${encodeURIComponent(error?.message || "Could not create campaign")}`);
  revalidatePath("/ops/honest-gm");
  redirect(`/ops/honest-gm?campaign=${campaign.id}&created=1`);
}

export default async function HonestGmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const sb = await createServerClient();
  const { data } = await sb.auth.getUser();
  if (!hasOpsAccess(data?.user || null)) redirect("/staff-login");

  const params = await searchParams;
  const admin = getSupabaseAdmin();
  const { data: campaigns, error } = await (admin as any)
    .from("honest_gm_campaigns")
    .select("id,name,created_at,updated_at,premise,premise_hash,access_key,character_name,character_state,status")
    .order("created_at", { ascending: false })
    .limit(50);

  const selectedId = params.campaign || campaigns?.[0]?.id || "";
  const selected = (campaigns || []).find((item: any) => item.id === selectedId) || null;

  const [canonResult, eventResult, rollResult] = selected
    ? await Promise.all([
        (admin as any).from("honest_gm_canon").select("id,created_at,category,subject,fact").eq("campaign_id", selected.id).order("created_at", { ascending: false }).limit(50),
        (admin as any).from("honest_gm_events").select("id,created_at,event_type,summary").eq("campaign_id", selected.id).order("created_at", { ascending: false }).limit(30),
        (admin as any).from("honest_gm_rolls").select("id,created_at,roll_kind,label,rolls,selected_roll,modifier,total,dc,success,mode").eq("campaign_id", selected.id).order("created_at", { ascending: false }).limit(30),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }];

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <div className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-400">TCG Magnet Lab</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Honest GM</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">Immutable world premise, append-only campaign canon, persistent character state, and dice generated outside the language model.</p>
          </div>
          <div className="flex gap-2">
            <Link href="/ops/tcg-leads" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200">TCG Ops</Link>
            <Link href="/tcg-magnet" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200">Public site</Link>
          </div>
        </div>

        {params.error ? <div className="mb-5 rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-200">{params.error}</div> : null}
        {params.created ? <div className="mb-5 rounded-lg border border-emerald-800 bg-emerald-950/50 p-4 text-sm text-emerald-200">Campaign created. Its premise is now locked as source truth.</div> : null}
        {error ? <div className="mb-5 rounded-lg border border-red-800 bg-red-950/60 p-4 text-sm text-red-200">{error.message}</div> : null}

        <div className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <div className="space-y-6">
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <h2 className="text-lg font-black">Create campaign</h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">Upload a plain-text premise or paste it below. Once saved, the premise cannot be edited.</p>
              <form action={createCampaign} className="mt-4 grid gap-3">
                <label className="grid gap-1 text-sm font-bold">
                  Campaign name
                  <input name="name" required maxLength={120} className={inputClass} placeholder="The Blackwater Road" />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Character name
                  <input name="character_name" maxLength={120} className={inputClass} placeholder="Garrick Vane" />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Premise file
                  <input name="premise_file" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:font-bold file:text-white" />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Or paste premise
                  <textarea name="premise" rows={9} className={inputClass} placeholder="World history, factions, geography, magic rules, hard truths..." />
                </label>
                <label className="grid gap-1 text-sm font-bold">
                  Initial character state (optional JSON)
                  <textarea name="character_state" rows={5} className={`${inputClass} font-mono text-xs`} placeholder={'{"level":3,"hp":31,"inventory":["longsword"]}'} />
                </label>
                <button className="mt-1 min-h-11 rounded-md bg-amber-400 px-4 font-black text-slate-950 hover:bg-amber-300">Lock premise & create</button>
              </form>
            </section>

            <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900">
              <div className="border-b border-slate-800 px-4 py-3 text-sm font-black">Campaigns</div>
              {(campaigns || []).map((campaign: any) => (
                <Link key={campaign.id} href={`/ops/honest-gm?campaign=${campaign.id}`} className={`block border-b border-slate-800 px-4 py-3 last:border-0 ${campaign.id === selectedId ? "bg-slate-800" : "hover:bg-slate-800/60"}`}>
                  <div className="font-bold">{campaign.name}</div>
                  <div className="mt-1 text-xs text-slate-500">{campaign.character_name || "No character"} · {formatDate(campaign.updated_at)}</div>
                </Link>
              ))}
              {!campaigns?.length ? <div className="p-4 text-sm text-slate-500">No campaigns yet.</div> : null}
            </section>
          </div>

          <div className="min-w-0 space-y-6">
            {selected ? (
              <>
                <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Premise locked</p>
                      <h2 className="mt-1 text-2xl font-black">{selected.name}</h2>
                      <p className="mt-1 text-sm text-slate-400">{selected.character_name || "No character name set"}</p>
                    </div>
                    <span className="rounded-full bg-slate-800 px-3 py-1 text-xs font-black uppercase text-slate-300">{selected.status}</span>
                  </div>
                  <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
                    <div className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Immutable world premise</div>
                    <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-200">{selected.premise}</pre>
                  </div>
                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <KeyValue label="Campaign ID" value={selected.id} mono />
                    <KeyValue label="Premise SHA-256" value={selected.premise_hash} mono />
                    <KeyValue label="Campaign access key" value={selected.access_key} mono sensitive />
                    <KeyValue label="MCP endpoint" value="/api/mcp/honest-gm" mono />
                  </div>
                  <div className="mt-4 rounded-lg border border-amber-900/80 bg-amber-950/30 p-4 text-xs leading-5 text-amber-100">
                    Treat the access key like a password. A ChatGPT client uses the campaign ID + access key when calling the six Honest GM tools. Do not publish either credential in screenshots or documentation.
                  </div>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <Panel title="Character state">
                    <pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">{JSON.stringify(selected.character_state || {}, null, 2)}</pre>
                  </Panel>
                  <Panel title="MCP tools">
                    <ul className="grid gap-2 text-sm text-slate-300">
                      <li><b className="text-white">get_world</b> — premise + state + recent canon</li>
                      <li><b className="text-white">get_canon</b> — continuity lookup</li>
                      <li><b className="text-white">record_event</b> — append events and facts</li>
                      <li><b className="text-white">update_character</b> — persist state changes</li>
                      <li><b className="text-white">roll_check</b> — honest d20 with DC set first</li>
                      <li><b className="text-white">roll_damage</b> — honest dice damage</li>
                    </ul>
                  </Panel>
                </section>

                <section className="grid gap-6 lg:grid-cols-2">
                  <Panel title="Established canon">
                    <div className="grid gap-3">
                      {(canonResult.data || []).map((item: any) => (
                        <div key={item.id} className="border-b border-slate-800 pb-3 last:border-0">
                          <div className="text-xs font-black uppercase tracking-wider text-amber-400">{item.category} · {item.subject}</div>
                          <div className="mt-1 text-sm leading-5 text-slate-200">{item.fact}</div>
                        </div>
                      ))}
                      {!canonResult.data?.length ? <p className="text-sm text-slate-500">Nothing established during play yet.</p> : null}
                    </div>
                  </Panel>

                  <Panel title="Recent events">
                    <div className="grid gap-3">
                      {(eventResult.data || []).map((item: any) => (
                        <div key={item.id} className="border-b border-slate-800 pb-3 last:border-0">
                          <div className="text-xs font-black uppercase tracking-wider text-slate-500">{item.event_type} · {formatDate(item.created_at)}</div>
                          <div className="mt-1 text-sm leading-5 text-slate-200">{item.summary}</div>
                        </div>
                      ))}
                      {!eventResult.data?.length ? <p className="text-sm text-slate-500">No campaign history yet.</p> : null}
                    </div>
                  </Panel>
                </section>

                <Panel title="Dice audit trail">
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px] text-left text-sm">
                      <thead className="text-xs uppercase tracking-wider text-slate-500"><tr><th className="pb-3">When</th><th className="pb-3">Roll</th><th className="pb-3">Raw</th><th className="pb-3">Modifier</th><th className="pb-3">Total</th><th className="pb-3">DC</th><th className="pb-3">Result</th></tr></thead>
                      <tbody className="divide-y divide-slate-800">
                        {(rollResult.data || []).map((roll: any) => (
                          <tr key={roll.id}>
                            <td className="py-3 text-xs text-slate-500">{formatDate(roll.created_at)}</td>
                            <td className="py-3 font-bold">{roll.label}<div className="text-xs font-normal text-slate-500">{roll.mode || roll.roll_kind}</div></td>
                            <td className="py-3 font-mono">{(roll.rolls || []).join(", ")}</td>
                            <td className="py-3 font-mono">{roll.modifier >= 0 ? "+" : ""}{roll.modifier}</td>
                            <td className="py-3 font-mono font-black">{roll.total}</td>
                            <td className="py-3 font-mono">{roll.dc ?? "—"}</td>
                            <td className="py-3">{roll.success === null ? "—" : roll.success ? <span className="font-black text-emerald-400">SUCCESS</span> : <span className="font-black text-red-400">FAILURE</span>}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {!rollResult.data?.length ? <p className="py-3 text-sm text-slate-500">No dice rolled yet.</p> : null}
                  </div>
                </Panel>
              </>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-700 p-10 text-center text-slate-500">Create a campaign to establish its immutable world premise.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none focus:border-amber-400";

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h3 className="mb-4 text-lg font-black">{title}</h3>{children}</section>;
}

function KeyValue({ label, value, mono = false, sensitive = false }: { label: string; value: string; mono?: boolean; sensitive?: boolean }) {
  return <div className="min-w-0 rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div><div className={`mt-1 break-all text-xs text-slate-300 ${mono ? "font-mono" : ""}`}>{sensitive ? value : value}</div></div>;
}

function formatDate(value: string) {
  try { return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return value; }
}
