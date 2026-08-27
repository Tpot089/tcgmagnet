import Link from "next/link";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getSupabaseAdmin } from "@/utils/supabase/admin";

export const dynamic = "force-dynamic";

type SearchParams = {
  campaign?: string;
  key?: string;
  created?: string;
  error?: string;
};

async function createCampaign(formData: FormData) {
  "use server";

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

  const admin = getSupabaseAdmin();
  const { data: campaign, error } = await (admin as any)
    .from("honest_gm_campaigns")
    .insert({
      created_by: null,
      name,
      premise,
      character_name: characterName,
      character_state: characterState,
    })
    .select("id,access_key")
    .single();

  if (error || !campaign) {
    redirect(`/ops/honest-gm?error=${encodeURIComponent(error?.message || "Could not create campaign")}`);
  }

  revalidatePath("/ops/honest-gm");
  redirect(`/ops/honest-gm?campaign=${campaign.id}&key=${campaign.access_key}&created=1`);
}

export default async function HonestGmPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const admin = getSupabaseAdmin();

  let selected: any = null;
  let canon: any[] = [];
  let events: any[] = [];
  let rolls: any[] = [];
  let lookupError = "";

  if (params.campaign && params.key) {
    const { data, error } = await (admin as any)
      .from("honest_gm_campaigns")
      .select("id,name,created_at,updated_at,premise,premise_hash,access_key,character_name,character_state,status")
      .eq("id", params.campaign)
      .eq("access_key", params.key)
      .maybeSingle();

    if (error) lookupError = error.message;
    if (!error && !data) lookupError = "Campaign link is invalid.";
    selected = data || null;

    if (selected) {
      const [canonResult, eventResult, rollResult] = await Promise.all([
        (admin as any).from("honest_gm_canon").select("id,created_at,category,subject,fact").eq("campaign_id", selected.id).order("created_at", { ascending: false }).limit(50),
        (admin as any).from("honest_gm_events").select("id,created_at,event_type,summary").eq("campaign_id", selected.id).order("created_at", { ascending: false }).limit(30),
        (admin as any).from("honest_gm_rolls").select("id,created_at,roll_kind,label,rolls,modifier,total,dc,success,mode").eq("campaign_id", selected.id).order("created_at", { ascending: false }).limit(30),
      ]);
      canon = canonResult.data || [];
      events = eventResult.data || [];
      rolls = rollResult.data || [];
    }
  }

  return (
    <div className="min-h-screen bg-slate-950 px-4 py-8 text-slate-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.28em] text-amber-400">TCG Magnet Lab</p>
            <h1 className="mt-2 text-3xl font-black sm:text-4xl">Honest GM</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">No login. Create a campaign, keep its private link, and use that campaign as the source of truth.</p>
          </div>
          <Link href="/tcg-magnet" className="rounded-md border border-slate-700 px-3 py-2 text-sm font-bold text-slate-200">TCG Magnet</Link>
        </header>

        {params.error ? <Notice tone="error">{params.error}</Notice> : null}
        {lookupError ? <Notice tone="error">{lookupError}</Notice> : null}
        {params.created && selected ? <Notice tone="success">Campaign created. Save this page URL; it is the private key to reopen this campaign.</Notice> : null}

        {!selected ? (
          <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
            <h2 className="text-xl font-black">Create campaign</h2>
            <p className="mt-1 text-sm text-slate-400">The premise becomes immutable the moment the campaign is created.</p>
            <form action={createCampaign} className="mt-5 grid gap-4">
              <div className="grid gap-4 md:grid-cols-2">
                <label className="grid gap-1 text-sm font-bold">Campaign name<input name="name" required maxLength={120} className={inputClass} placeholder="The Blackwater Road" /></label>
                <label className="grid gap-1 text-sm font-bold">Character name<input name="character_name" maxLength={120} className={inputClass} placeholder="Garrick Vane" /></label>
              </div>
              <label className="grid gap-1 text-sm font-bold">Premise file<input name="premise_file" type="file" accept=".txt,.md,.json,text/plain,text/markdown,application/json" className="block w-full text-sm text-slate-300 file:mr-3 file:rounded-md file:border-0 file:bg-slate-700 file:px-3 file:py-2 file:font-bold file:text-white" /></label>
              <label className="grid gap-1 text-sm font-bold">Or paste premise<textarea name="premise" rows={12} className={inputClass} placeholder="World history, factions, geography, magic rules, hard truths..." /></label>
              <label className="grid gap-1 text-sm font-bold">Initial character state (optional JSON)<textarea name="character_state" rows={5} className={`${inputClass} font-mono text-xs`} placeholder={'{"level":3,"hp":31,"inventory":["longsword"]}'} /></label>
              <button className="min-h-11 rounded-md bg-amber-400 px-4 font-black text-slate-950 hover:bg-amber-300">Lock premise & create</button>
            </form>
          </section>
        ) : (
          <>
            <section className="rounded-xl border border-slate-800 bg-slate-900 p-5">
              <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">Premise locked</p>
              <h2 className="mt-1 text-2xl font-black">{selected.name}</h2>
              <p className="mt-1 text-sm text-slate-400">{selected.character_name || "No character name set"}</p>
              <div className="mt-5 rounded-lg border border-slate-800 bg-slate-950 p-4">
                <div className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">Immutable world premise</div>
                <pre className="max-h-[34rem] overflow-auto whitespace-pre-wrap break-words font-sans text-sm leading-6 text-slate-200">{selected.premise}</pre>
              </div>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <KeyValue label="Campaign ID" value={selected.id} />
                <KeyValue label="Premise SHA-256" value={selected.premise_hash} />
                <KeyValue label="Campaign access key" value={selected.access_key} />
                <KeyValue label="MCP endpoint" value="https://tcgmagnet.ca/api/mcp/honest-gm" />
              </div>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Panel title="Character state"><pre className="overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-300">{JSON.stringify(selected.character_state || {}, null, 2)}</pre></Panel>
              <Panel title="Established canon">{canon.length ? canon.map((item) => <Entry key={item.id} meta={`${item.category} · ${item.subject}`} text={item.fact} />) : <Empty text="Nothing established during play yet." />}</Panel>
            </section>

            <section className="grid gap-6 lg:grid-cols-2">
              <Panel title="Recent events">{events.length ? events.map((item) => <Entry key={item.id} meta={`${item.event_type} · ${formatDate(item.created_at)}`} text={item.summary} />) : <Empty text="No campaign history yet." />}</Panel>
              <Panel title="Dice audit trail">{rolls.length ? rolls.map((roll) => <Entry key={roll.id} meta={`${roll.label} · ${formatDate(roll.created_at)}`} text={`Raw ${(roll.rolls || []).join(", ")} ${roll.modifier >= 0 ? "+" : ""}${roll.modifier} = ${roll.total}${roll.dc == null ? "" : ` vs DC ${roll.dc}`} ${roll.success == null ? "" : roll.success ? "SUCCESS" : "FAILURE"}`} />) : <Empty text="No rolls yet." />}</Panel>
            </section>

            <div className="flex flex-wrap gap-3">
              <Link href="/ops/honest-gm" className="rounded-md bg-amber-400 px-4 py-2 text-sm font-black text-slate-950">Create another campaign</Link>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="rounded-xl border border-slate-800 bg-slate-900 p-5"><h3 className="mb-4 text-lg font-black">{title}</h3><div className="space-y-3">{children}</div></section>;
}

function Entry({ meta, text }: { meta: string; text: string }) {
  return <div className="border-b border-slate-800 pb-3 last:border-0"><div className="text-xs font-black uppercase tracking-wider text-slate-500">{meta}</div><div className="mt-1 text-sm leading-5 text-slate-200">{text}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <p className="text-sm text-slate-500">{text}</p>;
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg border border-slate-800 bg-slate-950 p-3"><div className="text-xs font-black uppercase tracking-wider text-slate-500">{label}</div><div className="mt-1 break-all font-mono text-xs text-slate-200">{value}</div></div>;
}

function Notice({ tone, children }: { tone: "error" | "success"; children: React.ReactNode }) {
  const classes = tone === "error" ? "border-red-800 bg-red-950/60 text-red-200" : "border-emerald-800 bg-emerald-950/50 text-emerald-200";
  return <div className={`rounded-lg border p-4 text-sm ${classes}`}>{children}</div>;
}

function formatDate(value: string) {
  try { return new Intl.DateTimeFormat("en-CA", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)); }
  catch { return value; }
}

const inputClass = "min-h-11 rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-base text-white outline-none focus:border-amber-400";
