"use client";

import { useState, type FormEvent } from "react";
import { TCG_LEAD_STATUSES } from "@/lib/tcgMagnet";

type Props = {
  leadId: string;
  initialStatus: string;
  initialValues: {
    internal_notes?: string | null;
    initial_offer?: number | null;
    final_purchase_price?: number | null;
    expected_resale_value?: number | null;
    actual_resale_value?: number | null;
    follow_up_date?: string | null;
  };
};

export default function TcgLeadAdminControls({ leadId, initialStatus, initialValues }: Props) {
  const [status, setStatus] = useState(initialStatus || "New");
  const [note, setNote] = useState("");
  const [initialOffer, setInitialOffer] = useState(initialValues.initial_offer?.toString() || "");
  const [finalPurchasePrice, setFinalPurchasePrice] = useState(initialValues.final_purchase_price?.toString() || "");
  const [expectedResaleValue, setExpectedResaleValue] = useState(initialValues.expected_resale_value?.toString() || "");
  const [actualResaleValue, setActualResaleValue] = useState(initialValues.actual_resale_value?.toString() || "");
  const [followUpDate, setFollowUpDate] = useState(initialValues.follow_up_date || "");
  const [message, setMessage] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function save(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/ops/tcg-leads/${leadId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          status,
          note,
          initial_offer: initialOffer,
          final_purchase_price: finalPurchasePrice,
          expected_resale_value: expectedResaleValue,
          actual_resale_value: actualResaleValue,
          follow_up_date: followUpDate || null,
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok || !json?.ok) throw new Error(json?.error || "Save failed");
      setNote("");
      setMessage("Saved.");
    } catch (error: any) {
      setMessage(error?.message || "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={save} className="grid gap-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm font-semibold">
          Status
          <select className={inputClass} value={status} onChange={(event) => setStatus(event.target.value)}>
            {TCG_LEAD_STATUSES.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-semibold">
          Follow-up date
          <input className={inputClass} type="date" value={followUpDate} onChange={(event) => setFollowUpDate(event.target.value)} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-4">
        <Money label="Initial offer" value={initialOffer} onChange={setInitialOffer} />
        <Money label="Final purchase" value={finalPurchasePrice} onChange={setFinalPurchasePrice} />
        <Money label="Expected resale" value={expectedResaleValue} onChange={setExpectedResaleValue} />
        <Money label="Actual resale" value={actualResaleValue} onChange={setActualResaleValue} />
      </div>
      <label className="grid gap-1 text-sm font-semibold">
        Add internal note
        <textarea className={inputClass} rows={3} value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <div className="flex items-center gap-3">
        <button type="submit" disabled={saving} className="min-h-10 rounded-md bg-slate-950 px-4 text-sm font-bold text-white disabled:opacity-60">
          {saving ? "Saving..." : "Save lead"}
        </button>
        {message ? <span className="text-sm text-slate-600">{message}</span> : null}
      </div>
    </form>
  );
}

function Money({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className="grid gap-1 text-sm font-semibold">
      {label}
      <input className={inputClass} inputMode="decimal" value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

const inputClass = "min-h-10 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200";
