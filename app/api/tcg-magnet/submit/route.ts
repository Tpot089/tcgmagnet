import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import { sendEmail } from "@/lib/email";
import { buildTcgLeadNotificationEmail } from "@/lib/tcgMagnetEmail";
import { TcgLeadSubmissionSchema, assertLeadPhotoPath, makeReference } from "@/lib/tcgMagnet";

export const runtime = "nodejs";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

function getBaseUrl(req: Request) {
  return (
    process.env.TCG_MAGNET_INTERNAL_BASE_URL ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    new URL(req.url).origin
  ).replace(/\/+$/, "");
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const parsed = TcgLeadSubmissionSchema.safeParse(body);
    if (!parsed.success) {
      return jsonError(400, "invalid_submission", "Check the required fields and uploaded photos");
    }
    const lead = parsed.data;
    const invalidPath = lead.photo_paths.find((photo) => !assertLeadPhotoPath(lead.submissionRef, photo.path));
    if (invalidPath) {
      return jsonError(400, "invalid_photo_path", "One uploaded photo path is invalid");
    }

    const admin = getSupabaseAdmin();
    const insertPayload = {
      status: "New",
      full_name: lead.full_name,
      email: lead.email,
      phone: lead.phone,
      city: lead.city,
      province: lead.province,
      card_games: lead.card_games,
      collection_types: lead.collection_types,
      approximate_card_count: lead.approximate_card_count,
      estimated_value: lead.estimated_value,
      important_items: lead.important_items,
      condition_notes: lead.condition_notes,
      selling_scope: lead.selling_scope,
      selling_timeline: lead.selling_timeline,
      willing_to_ship: lead.willing_to_ship,
      additional_details: lead.additional_details,
      photo_paths: lead.photo_paths,
      consent_confirmed: lead.consent_confirmed,
      source: lead.attribution.source,
      medium: lead.attribution.medium,
      campaign: lead.attribution.campaign,
      term: lead.attribution.term,
      content: lead.attribution.content,
      gclid: lead.attribution.gclid,
      landing_page: lead.attribution.landing_page,
      referrer: lead.attribution.referrer,
      first_touch_at: lead.attribution.first_touch_at,
    };

    const { data, error } = await (admin as any)
      .from("tcg_collection_leads")
      .insert(insertPayload as any)
      .select("id")
      .single();
    if (error || !data?.id) {
      console.error("[tcg_submit] insert_failed", { message: error?.message });
      return jsonError(500, "save_failed", "Could not save the submission");
    }

    const leadId = String(data.id);
    const reference = makeReference(leadId);
    const notifyTo = process.env.TCG_MAGNET_LEAD_NOTIFY_EMAIL || process.env.LEAD_NOTIFY_EMAIL;
    let emailOk = false;
    if (notifyTo) {
      try {
        const leadUrl = `${getBaseUrl(req)}/ops/tcg-leads?lead=${encodeURIComponent(leadId)}`;
        const emailContent = buildTcgLeadNotificationEmail({ lead, leadId, reference, leadUrl });
        const emailRes = await sendEmail({
          to: notifyTo,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        emailOk = Boolean(emailRes.ok);
        if (!emailRes.ok) {
          console.error("[tcg_submit] notification_failed", {
            lead_id: leadId,
            error: emailRes.error || "email_failed",
          });
        }
      } catch (error: any) {
        console.error("[tcg_submit] notification_failed", {
          lead_id: leadId,
          message: error?.message || String(error),
        });
      }
    } else {
      console.warn("[tcg_submit] notification_skipped", { lead_id: leadId, reason: "missing_notify_email" });
    }

    return NextResponse.json({ ok: true, leadId, reference, emailOk });
  } catch (error: any) {
    console.error("[tcg_submit] unknown_error", { message: error?.message || String(error) });
    return jsonError(500, "unknown_error", "Could not submit the collection");
  }
}
