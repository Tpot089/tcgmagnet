"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";

export default function StaffLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const supabase = createClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (signInError) throw signInError;
      router.push("/ops/tcg-leads");
      router.refresh();
    } catch (err: any) {
      setError(err?.message || "Could not sign in");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0b0f14] px-4 text-slate-950">
      <form onSubmit={submit} className="grid w-full max-w-md gap-4 rounded-lg bg-white p-6 shadow-2xl">
        <div>
          <p className="text-sm font-bold uppercase tracking-[0.2em] text-teal-700">TCG Magnet</p>
          <h1 className="mt-2 text-2xl font-black">Ops sign in</h1>
        </div>
        <label className="grid gap-1 text-sm font-bold">
          Email
          <input className={inputClass} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm font-bold">
          Password
          <input className={inputClass} type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
        </label>
        {error ? <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{error}</div> : null}
        <button className="min-h-11 rounded-md bg-slate-950 px-4 font-black text-white disabled:opacity-60" disabled={busy}>
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
}

const inputClass = "min-h-11 rounded-md border border-slate-300 bg-white px-3 py-2 text-base outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-200";
