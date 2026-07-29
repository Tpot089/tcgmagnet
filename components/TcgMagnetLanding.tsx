"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Camera, Check, ChevronRight, Loader2, ShieldCheck, Trash2, Upload } from "lucide-react";
import {
  TCG_COLLECTION_TYPES,
  TCG_MAX_PHOTO_BYTES,
  TCG_MAX_PHOTO_COUNT,
  TCG_SELLING_TIMELINES,
  type TcgUploadedPhoto,
} from "@/lib/tcgMagnet";
import { fireSubmitLeadFormConversion } from "@/lib/googleAds";

type PhotoPreview = {
  id: string;
  file: File;
  url: string;
  status: "ready" | "uploading" | "done" | "error";
  message?: string;
  uploaded?: TcgUploadedPhoto;
};

type Attribution = {
  source: string | null;
  medium: string | null;
  campaign: string | null;
  term: string | null;
  content: string | null;
  gclid: string | null;
  landing_page: string | null;
  referrer: string | null;
  first_touch_at: string | null;
};

const provinces = ["AB", "BC", "MB", "NB", "NL", "NS", "NT", "NU", "ON", "PE", "QC", "SK", "YT"];

const gameOptions = [
  {
    value: "Pokemon",
    label: "Pokémon",
    image: "/images/games/pokemon-pack.webp",
  },
  {
    value: "Magic: The Gathering",
    label: "Magic: The Gathering",
    image: "/images/games/magic-pack.webp",
  },
  {
    value: "Yu-Gi-Oh!",
    label: "Yu-Gi-Oh!",
    image: "/images/games/yugioh-pack.webp",
  },
  {
    value: "One Piece",
    label: "One Piece",
    image: "/images/games/one-piece-pack.webp",
  },
  {
    value: "Dragon Ball Super",
    label: "Dragon Ball Super",
    image: "/images/games/dragon-ball-pack.webp",
  },
  {
    value: "Sports cards",
    label: "Sports Cards",
    image: "/images/games/sports-pack.webp",
  },
  {
    value: "Other",
    label: "Other",
    image: "/images/games/other-pack.webp",
  },
] as const;

const blankAttribution: Attribution = {
  source: null,
  medium: null,
  campaign: null,
  term: null,
  content: null,
  gclid: null,
  landing_page: null,
  referrer: null,
  first_touch_at: null,
};

function makeSubmissionRef() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID().replace(/-/g, "");
  }
  return `${Date.now()}${Math.random().toString(36).slice(2, 14)}`;
}

function readFirstTouch(): Attribution {
  if (typeof window === "undefined") return blankAttribution;
  const key = "tcg_magnet_first_touch";
  const existing = window.localStorage.getItem(key);
  if (existing) {
    try {
      return { ...blankAttribution, ...JSON.parse(existing) };
    } catch {
      window.localStorage.removeItem(key);
    }
  }

  const params = new URLSearchParams(window.location.search);
  const value: Attribution = {
    source: params.get("utm_source"),
    medium: params.get("utm_medium"),
    campaign: params.get("utm_campaign"),
    term: params.get("utm_term"),
    content: params.get("utm_content"),
    gclid: params.get("gclid"),
    landing_page: window.location.href,
    referrer: document.referrer || null,
    first_touch_at: new Date().toISOString(),
  };
  window.localStorage.setItem(key, JSON.stringify(value));
  return value;
}

export default function TcgMagnetLanding() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const photosRef = useRef<PhotoPreview[]>([]);
  const submissionRef = useMemo(() => makeSubmissionRef(), []);
  const [attribution, setAttribution] = useState<Attribution>(blankAttribution);
  const [photos, setPhotos] = useState<PhotoPreview[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    full_name: "",
    email: "",
    phone: "",
    city: "",
    province: "",
    card_games: [] as string[],
    collection_types: [] as string[],
    approximate_card_count: "",
    estimated_value: "",
    important_items: "",
    condition_notes: "",
    selling_scope: "All",
    selling_timeline: "",
    willing_to_ship: "Unsure",
    additional_details: "",
    consent_confirmed: false,
  });

  useEffect(() => {
    setAttribution(readFirstTouch());
  }, []);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    return () => {
      photosRef.current.forEach((photo) => URL.revokeObjectURL(photo.url));
    };
  }, []);

  function updateText(event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) {
    const target = event.target;
    const value = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value;
    setForm((current) => ({ ...current, [target.name]: value }));
  }

  function toggleList(name: "card_games" | "collection_types", value: string) {
    setForm((current) => {
      const set = new Set(current[name]);
      if (set.has(value)) set.delete(value);
      else set.add(value);
      return { ...current, [name]: Array.from(set) };
    });
  }

  function addPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    const currentCount = photos.length;
    const next = Array.from(files).slice(0, Math.max(0, TCG_MAX_PHOTO_COUNT - currentCount));
    const accepted: PhotoPreview[] = [];
    for (const file of next) {
      if (!file.type.startsWith("image/")) {
        setError("Upload common image files only.");
        continue;
      }
      if (file.size > TCG_MAX_PHOTO_BYTES) {
        setError("Each image must be 8 MB or smaller.");
        continue;
      }
      accepted.push({
        id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        file,
        url: URL.createObjectURL(file),
        status: "ready",
      });
    }
    if (currentCount + accepted.length >= TCG_MAX_PHOTO_COUNT && files.length > accepted.length) {
      setError(`You can upload up to ${TCG_MAX_PHOTO_COUNT} photos.`);
    }
    setPhotos((current) => [...current, ...accepted]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePhoto(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((photo) => photo.id !== id);
    });
  }

  async function uploadPhoto(photo: PhotoPreview): Promise<TcgUploadedPhoto> {
    if (photo.uploaded) return photo.uploaded;
    setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, status: "uploading", message: "" } : item)));
    const signRes = await fetch("/api/tcg-magnet/photos/sign", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        submissionRef,
        filename: photo.file.name,
        contentType: photo.file.type,
        bytes: photo.file.size,
      }),
    });
    const signJson = await signRes.json().catch(() => null);
    if (!signRes.ok || !signJson?.uploadUrl) {
      throw new Error(signJson?.error || "Could not prepare photo upload");
    }

    const uploadRes = await fetch(signJson.uploadUrl, {
      method: "PUT",
      headers: { "content-type": photo.file.type },
      body: photo.file,
    });
    if (!uploadRes.ok) throw new Error("Photo upload failed");

    const uploaded = {
      bucket: String(signJson.bucket),
      path: String(signJson.path),
      originalName: photo.file.name,
      contentType: photo.file.type,
      bytes: photo.file.size,
    };
    setPhotos((current) => current.map((item) => (item.id === photo.id ? { ...item, status: "done", uploaded } : item)));
    return uploaded;
  }

  function validate() {
    if (!form.full_name || !form.email || !form.phone || !form.city || !form.province) return "Enter your contact information.";
    if (!form.card_games.length) return "Select at least one card game.";
    if (!form.collection_types.length) return "Select at least one collection type.";
    if (!form.approximate_card_count || !form.important_items || !form.selling_timeline) return "Complete the collection details.";
    if (!photos.length) return "Upload at least one photo of the collection.";
    if (!form.consent_confirmed) return "Confirm you own or are authorized to sell the items.";
    return null;
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const uploaded = [];
      for (const photo of photos) {
        uploaded.push(await uploadPhoto(photo));
      }

      const res = await fetch("/api/tcg-magnet/submit", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          submissionRef,
          ...form,
          photo_paths: uploaded,
          attribution,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Could not submit your collection");

      const conversionKey = `tcg_magnet_conversion_${json.leadId}`;
      if (!window.sessionStorage.getItem(conversionKey)) {
        window.sessionStorage.setItem(conversionKey, "1");
        const dl = (window as any).dataLayer || ((window as any).dataLayer = []);
        dl.push({
          event: "tcg_collection_submitted",
          lead_id: json.leadId,
          reference: json.reference,
          submitted_at: new Date().toISOString(),
        });
        fireSubmitLeadFormConversion("tcg_magnet");
      }
      router.push(`/tcg-magnet/confirmation?ref=${encodeURIComponent(json.reference)}`);
    } catch (err: any) {
      console.error(err);
      setPhotos((current) => current.map((photo) => (photo.status === "uploading" ? { ...photo, status: "error", message: err?.message } : photo)));
      setError(err?.message || "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="w-full bg-[#030507] text-slate-100">
      <section className="relative overflow-hidden border-b border-[#1b5fad]/40 px-4 py-12 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_72%_18%,rgba(46,141,255,0.32),transparent_32%),radial-gradient(circle_at_18%_76%,rgba(211,33,38,0.18),transparent_26%),linear-gradient(135deg,#030507_0%,#0b1119_48%,#030507_100%)]" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#68b8ff] to-transparent" />
        <div className="relative mx-auto grid max-w-6xl gap-10 lg:grid-cols-[0.92fr_1.08fr] lg:items-center">
          <div>
            <div className="mb-5 inline-flex items-center gap-3 rounded-md border border-[#2d7ed0]/50 bg-black/45 px-3 py-2 shadow-[0_0_28px_rgba(45,126,208,0.22)]">
              <span className="h-2.5 w-2.5 rounded-full bg-[#d9272f]" />
              <span className="text-xs font-black uppercase tracking-[0.24em] text-[#9fd4ff]">Buy · Trade · Consign</span>
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-tight text-white sm:text-6xl">
              Turn Your Trading Card Collection Into Cash
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-8 text-slate-200">
              Submit photos and information about your trading-card collection to receive a direct offer from TCG Magnet.
            </p>
            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <a href="#submit-collection" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-md bg-[#2b8dff] px-5 font-black text-white shadow-[0_0_28px_rgba(43,141,255,0.42)] transition hover:bg-[#66b7ff]">
                Submit Your Collection <ChevronRight size={18} />
              </a>
              <p className="max-w-xl text-sm leading-6 text-slate-300">
                Pokemon, Magic, Yu-Gi-Oh!, Dragon Ball Super, graded cards, sealed products, binders, singles, and full collections.
              </p>
            </div>
          </div>
          <div className="relative">
            <div className="absolute inset-8 rounded-full bg-[#2b8dff]/25 blur-3xl" />
            <Image
              src="/tcg-magnet-logo.png"
              alt="TCG Magnet"
              width={620}
              height={620}
              priority
              className="relative mx-auto w-full max-w-[620px] drop-shadow-[0_28px_60px_rgba(0,0,0,0.72)]"
            />
          </div>
        </div>
      </section>

      <section className="bg-[#070a0e] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-3">
          {["Submit your collection and upload photos.", "We review the cards and contact you.", "We negotiate an offer and arrange the transaction."].map((step, index) => (
            <div key={step} className="rounded-lg border border-[#244f83]/70 bg-[#0c1118] p-6 shadow-[0_18px_44px_rgba(0,0,0,0.22)]">
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-md border border-[#70bcff]/60 bg-[#10243a] font-black text-[#9fd4ff]">{index + 1}</div>
              <h2 className="text-xl font-black">How It Works</h2>
              <p className="mt-3 text-slate-300">{step}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="border-y border-[#1b5fad]/40 bg-[#020304] px-4 py-14 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-6xl gap-10 lg:grid-cols-2">
          <InfoBlock
            title="What We Buy"
            items={[
              "Complete collections",
              "High-value singles",
              "Graded cards",
              "Vintage cards",
              "Modern cards",
              "Sealed booster boxes and products",
              "Binders",
              "Bulk collections when included with stronger inventory",
            ]}
          />
          <InfoBlock
            title="Why Sell to TCG Magnet"
            items={[
              "Direct communication",
              "Fast review process",
              "Clear offers",
              "No listing every card individually",
              "No dealing with dozens of buyers",
              "Local transactions where available",
              "Shipping options for Canadian sellers where appropriate",
            ]}
          />
        </div>
      </section>

      <section id="submit-collection" className="px-4 py-16 sm:px-6 lg:px-8">
        <form onSubmit={handleSubmit} className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <Image
              src="/tcg-magnet-logo.png"
              alt="TCG Magnet"
              width={160}
              height={160}
              className="mb-6 w-40 drop-shadow-[0_12px_30px_rgba(43,141,255,0.28)]"
            />
            <p className="text-sm font-bold uppercase tracking-[0.2em] text-[#9fd4ff]">Collection Submission</p>
            <h2 className="mt-3 text-3xl font-black text-white">Sell Your Trading Card Collection</h2>
            <p className="mt-4 leading-7 text-slate-300">
              Upload clear photos of binder pages, valuable cards, graded labels, sealed products, and wide shots showing the whole collection.
            </p>
            <div className="mt-6 rounded-lg border border-[#2b8dff]/45 bg-[#07192b] p-4 text-sm leading-6 text-[#d9eeff] shadow-[0_0_34px_rgba(43,141,255,0.14)]">
              <ShieldCheck className="mb-3" size={22} />
              TCG Magnet purchases collections, graded cards, sealed products, binders, and high-value singles. Submitting details does not guarantee an offer.
            </div>
          </div>

          <div className="rounded-lg border border-[#b9dfff]/20 bg-[#f8fbff] p-5 text-slate-950 shadow-[0_24px_80px_rgba(0,0,0,0.42)] sm:p-7">
            <FormSection title="Contact information">
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name" id="full_name" required><input className={inputClass} id="full_name" name="full_name" autoComplete="name" value={form.full_name} onChange={updateText} /></Field>
                <Field label="Email" id="email" required><input className={inputClass} id="email" name="email" type="email" autoComplete="email" value={form.email} onChange={updateText} /></Field>
                <Field label="Phone number" id="phone" required><input className={inputClass} id="phone" name="phone" type="tel" autoComplete="tel" value={form.phone} onChange={updateText} /></Field>
                <Field label="City" id="city" required><input className={inputClass} id="city" name="city" autoComplete="address-level2" value={form.city} onChange={updateText} /></Field>
                <Field label="Province" id="province" required>
                  <select className={inputClass} id="province" name="province" value={form.province} onChange={updateText}>
                    <option value="">Select</option>
                    {provinces.map((province) => <option key={province} value={province}>{province}</option>)}
                  </select>
                </Field>
              </div>
            </FormSection>

            <FormSection title="Collection information">
              <GameChoiceGroup selected={form.card_games} onToggle={(value) => toggleList("card_games", value)} />
              <ChoiceGroup label="Collection type" values={TCG_COLLECTION_TYPES} selected={form.collection_types} onToggle={(value) => toggleList("collection_types", value)} />
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Approximate number of cards" id="approximate_card_count" required><input className={inputClass} id="approximate_card_count" name="approximate_card_count" value={form.approximate_card_count} onChange={updateText} placeholder="e.g. 2,000 cards" /></Field>
                <Field label="Estimated value, optional" id="estimated_value"><input className={inputClass} id="estimated_value" name="estimated_value" value={form.estimated_value} onChange={updateText} placeholder="e.g. $1,500" /></Field>
              </div>
              <Field label="Important cards or products" id="important_items" required><textarea className={inputClass} id="important_items" name="important_items" rows={4} value={form.important_items} onChange={updateText} /></Field>
              <Field label="Condition notes" id="condition_notes"><textarea className={inputClass} id="condition_notes" name="condition_notes" rows={3} value={form.condition_notes} onChange={updateText} /></Field>
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Sell all or part?" id="selling_scope" required>
                  <select className={inputClass} id="selling_scope" name="selling_scope" value={form.selling_scope} onChange={updateText}>
                    <option>All</option><option>Part</option><option>Unsure</option>
                  </select>
                </Field>
                <Field label="Desired timeline" id="selling_timeline" required>
                  <select className={inputClass} id="selling_timeline" name="selling_timeline" value={form.selling_timeline} onChange={updateText}>
                    <option value="">Select</option>
                    {TCG_SELLING_TIMELINES.map((timeline) => <option key={timeline}>{timeline}</option>)}
                  </select>
                </Field>
                <Field label="Willing to ship?" id="willing_to_ship" required>
                  <select className={inputClass} id="willing_to_ship" name="willing_to_ship" value={form.willing_to_ship} onChange={updateText}>
                    <option>Yes</option><option>No</option><option>Unsure</option>
                  </select>
                </Field>
              </div>
              <Field label="Additional details" id="additional_details"><textarea className={inputClass} id="additional_details" name="additional_details" rows={4} value={form.additional_details} onChange={updateText} /></Field>
            </FormSection>

            <FormSection title="Photo uploads">
              <input ref={fileInputRef} type="file" className="hidden" multiple accept="image/jpeg,image/png,image/webp,image/heic,image/heif" onChange={(event) => addPhotos(event.target.files)} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={submitting || photos.length >= TCG_MAX_PHOTO_COUNT} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md border border-[#1f6fbd] bg-[#07111d] px-4 font-bold text-white disabled:opacity-60">
                <Upload size={18} /> Select images
              </button>
              <p className="mt-2 text-sm text-slate-600">Up to {TCG_MAX_PHOTO_COUNT} images. Each image must be 8 MB or smaller.</p>
              {photos.length ? (
                <div className="mt-4 grid gap-3 sm:grid-cols-3">
                  {photos.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-md border border-slate-200 bg-slate-50">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={photo.url} alt={`Selected upload ${photo.file.name}`} className="h-32 w-full object-cover" />
                      <div className="flex items-center justify-between gap-2 p-2 text-xs">
                        <span className="truncate">{photo.file.name}</span>
                        <button type="button" aria-label={`Remove ${photo.file.name}`} onClick={() => removePhoto(photo.id)} disabled={submitting} className="rounded p-1 text-slate-600 hover:bg-slate-200">
                          <Trash2 size={16} />
                        </button>
                      </div>
                      <div className="px-2 pb-2 text-xs text-slate-600">{photo.status === "uploading" ? "Uploading..." : photo.status === "done" ? "Uploaded" : photo.status === "error" ? photo.message || "Error" : "Ready"}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="mt-4 flex min-h-28 items-center justify-center rounded-md border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                  <Camera className="mr-2" size={18} /> No photos selected yet
                </div>
              )}
            </FormSection>

            <label className="mt-6 flex gap-3 rounded-md border border-slate-200 bg-slate-50 p-4 text-sm leading-6">
              <input type="checkbox" name="consent_confirmed" checked={form.consent_confirmed} onChange={updateText} className="mt-1 h-5 w-5" />
              <span>I confirm that I own or am authorized to sell these items, the submitted information is accurate to the best of my knowledge, and TCG Magnet may contact me about the collection.</span>
            </label>

            {error ? <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}

            <button type="submit" disabled={submitting} className="mt-5 inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-md bg-[#2b8dff] px-5 font-black text-white shadow-[0_0_24px_rgba(43,141,255,0.36)] transition hover:bg-[#66b7ff] disabled:opacity-60">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />}
              {submitting ? "Submitting..." : "Submit Your Collection"}
            </button>
          </div>
        </form>
      </section>
    </div>
  );
}

function InfoBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <h2 className="text-3xl font-black text-white">{title}</h2>
      <div className="mt-6 grid gap-3">
        {items.map((item) => (
          <div key={item} className="flex items-start gap-3 rounded-md border border-white/10 bg-white/[0.04] p-4 text-slate-200">
            <Check className="mt-0.5 shrink-0 text-teal-300" size={18} />
            <span>{item}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-slate-200 py-6 first:pt-0">
      <h3 className="mb-4 text-lg font-black">{title}</h3>
      <div className="grid gap-4">{children}</div>
    </section>
  );
}

function Field({ label, id, required, children }: { label: string; id: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-sm font-bold text-slate-800">
        {label}{required ? <span className="text-red-600"> *</span> : null}
      </label>
      {children}
    </div>
  );
}

function ChoiceGroup({ label, values, selected, onToggle }: { label: string; values: readonly string[]; selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <div className="mb-2 text-sm font-bold text-slate-800">{label}</div>
      <div className="grid gap-2 sm:grid-cols-2">
        {values.map((value) => {
          const active = selected.includes(value);
          return (
            <button key={value} type="button" onClick={() => onToggle(value)} className={`min-h-11 rounded-md border px-3 text-left text-sm font-semibold ${active ? "border-teal-500 bg-teal-50 text-slate-950" : "border-slate-200 bg-white text-slate-700"}`}>
              {value}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function GameChoiceGroup({ selected, onToggle }: { selected: string[]; onToggle: (value: string) => void }) {
  return (
    <div>
      <div className="mb-3 text-sm font-bold text-slate-800">Card games included</div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
        {gameOptions.map((option) => {
          const active = selected.includes(option.value);
          return (
            <button
              key={option.value}
              type="button"
              aria-label={`${active ? "Remove" : "Select"} ${option.label}`}
              aria-pressed={active}
              onClick={() => onToggle(option.value)}
              className={`group relative flex min-h-[230px] flex-col overflow-hidden rounded-lg border bg-[#05080d] p-2 text-left shadow-sm transition duration-150 hover:-translate-y-0.5 hover:scale-[1.015] focus:outline-none focus:ring-4 focus:ring-[#66b7ff]/50 sm:min-h-[270px] ${
                active
                  ? "border-[#2b8dff] shadow-[0_0_26px_rgba(43,141,255,0.42)]"
                  : "border-slate-300/70 hover:border-[#6fbaff]/70"
              }`}
            >
              {active ? (
                <span className="absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/70 bg-[#2b8dff] text-white shadow-lg">
                  <Check size={16} strokeWidth={3} />
                </span>
              ) : null}
              <span className="relative flex flex-1 items-center justify-center overflow-hidden rounded-md bg-black">
                <Image
                  src={option.image}
                  alt=""
                  width={420}
                  height={590}
                  sizes="(min-width: 1280px) 180px, (min-width: 768px) 30vw, 44vw"
                  className="h-full w-full object-contain transition duration-150 group-hover:scale-[1.02]"
                />
              </span>
              <span className="mt-2 flex min-h-10 items-center justify-center rounded-md border border-white/10 bg-[#07111d] px-2 text-center text-xs font-black uppercase tracking-wide text-white sm:text-sm">
                {option.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

const inputClass = "min-h-11 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-base text-slate-950 outline-none transition focus:border-teal-500 focus:ring-2 focus:ring-teal-200";
