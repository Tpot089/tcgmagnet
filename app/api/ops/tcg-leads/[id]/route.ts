import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import { getOpsAuthContext, logOpsAuditEvent, opsAuthErrorResponse } from "@/app/api/_utils/opsAuth";
import { TCG_LEAD_STATUSES } from "@/lib/tcgMagnet";

export const runtime = "nodejs";

const UpdateSchema = z.object({
  status: z.enum(TCG_LEAD_STATUSES).optional(),
  note: z.string().trim().max(4000).optional(),
  initial_offer: z.union([z.string(), z.number(), z.null()]).optional(),
  final_purchase_price: z.union([z.string(), z.number(), z.null()]).optional(),
  expected_resale_value: z.union([z.string(), z.number(), z.null()]).optional(),
  actual_resale_value: z.union([z.string(), z.number(), z.null()]).optional(),
  follow_up_date: z.string().trim().max(20).nullable().optional(),
});

function money(value: unknown) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return Math.round(parsed * 100) / 100;
}

export async function PATCH(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const auth = await getOpsAuthContext();
  if (!auth.user) return opsAuthErrorResponse(auth);

  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid lead update" }, { status: 400 });
  }

  const patch = {
    status: parsed.data.status,
    initial_offer: money(parsed.data.initial_offer),
    final_purchase_price: money(parsed.data.final_purchase_price),
    expected_resale_value: money(parsed.data.expected_resale_value),
    actual_resale_value: money(parsed.data.actual_resale_value),
    follow_up_date: parsed.data.follow_up_date || null,
    updated_at: new Date().toISOString(),
  };

  const admin = getSupabaseAdmin();
  const { error } = await (admin as any).from("tcg_collection_leads").update(patch as any).eq("id", id);
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }

  const note = String(parsed.data.note || "").trim();
  if (note) {
    const { error: noteError } = await (admin as any).from("tcg_collection_lead_notes").insert({
      lead_id: id,
      note,
      actor_user_id: auth.user.id,
      actor_email: auth.user.email || null,
    } as any);
    if (noteError) {
      return NextResponse.json({ ok: false, error: noteError.message }, { status: 500 });
    }
  }

  await logOpsAuditEvent({
    actor_user_id: auth.user.id,
    actor_email: auth.user.email || null,
    action: "tcg_lead_updated",
    metadata: { lead_id: id, status: parsed.data.status || null, note_added: Boolean(note) },
  });

  return NextResponse.json({ ok: true });
}
