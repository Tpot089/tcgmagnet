import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import {
  TCG_LEAD_BUCKET,
  TCG_MAX_PHOTO_BYTES,
  assertLeadPhotoPath,
  isAllowedImage,
  sanitizeFilename,
} from "@/lib/tcgMagnet";

export const runtime = "nodejs";

function jsonError(status: number, code: string, message: string) {
  return NextResponse.json({ ok: false, code, error: message }, { status });
}

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const submissionRef = String(body?.submissionRef || "").trim();
    const filename = String(body?.filename || "").trim();
    const contentType = String(body?.contentType || "").trim().toLowerCase();
    const bytes = Number(body?.bytes || 0);

    if (!/^[a-zA-Z0-9_-]{12,80}$/.test(submissionRef) || !filename || !bytes) {
      return jsonError(400, "missing_fields", "Missing required upload fields");
    }
    if (!Number.isFinite(bytes) || bytes <= 0 || bytes > TCG_MAX_PHOTO_BYTES) {
      return jsonError(413, "file_too_large", "Each image must be 8 MB or smaller");
    }
    if (!isAllowedImage(filename, contentType)) {
      return jsonError(400, "invalid_file_type", "Upload JPG, PNG, WebP, HEIC, or HEIF images");
    }

    const admin = getSupabaseAdmin();
    const safeName = sanitizeFilename(filename);
    const path = `submissions/${submissionRef}/${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${safeName}`;
    if (!assertLeadPhotoPath(submissionRef, path)) {
      return jsonError(400, "invalid_path", "Invalid upload path");
    }

    const bucketCheck = await admin.storage.getBucket(TCG_LEAD_BUCKET);
    if (bucketCheck?.error || !bucketCheck?.data) {
      return jsonError(500, "bucket_missing", "Storage bucket is not configured");
    }

    const signed = await (admin.storage as any).from(TCG_LEAD_BUCKET).createSignedUploadUrl(path);
    if (signed?.error || !signed?.data?.signedUrl) {
      return jsonError(500, "sign_failed", signed?.error?.message || "Could not prepare upload");
    }

    return NextResponse.json({
      ok: true,
      bucket: TCG_LEAD_BUCKET,
      path,
      token: signed.data.token || null,
      uploadUrl: signed.data.signedUrl,
      maxBytes: TCG_MAX_PHOTO_BYTES,
    });
  } catch (error: any) {
    console.error("[tcg_photo_sign]", { message: error?.message || String(error) });
    return jsonError(500, "sign_failed", "Could not prepare upload");
  }
}
