import { z } from "zod";

export const TCG_LEAD_BUCKET = "tcg-lead-photos";
export const TCG_MAX_PHOTO_BYTES = 8 * 1024 * 1024;
export const TCG_MAX_PHOTO_COUNT = 12;

export const TCG_CARD_GAMES = [
  "Pokemon",
  "Magic: The Gathering",
  "Yu-Gi-Oh!",
  "Dragon Ball Super",
  "One Piece",
  "Sports cards",
  "Other",
] as const;

export const TCG_COLLECTION_TYPES = [
  "Raw singles",
  "Graded cards",
  "Sealed products",
  "Binders",
  "Complete collection",
  "Bulk",
  "Mixed collection",
] as const;

export const TCG_SELLING_TIMELINES = [
  "As soon as possible",
  "Within one week",
  "Within one month",
  "Just exploring offers",
] as const;

export const TCG_LEAD_STATUSES = [
  "New",
  "Reviewing",
  "Contacted",
  "Negotiating",
  "Purchased",
  "Follow Up",
  "Declined",
  "Lost",
] as const;

export const TCG_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"]);
export const TCG_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "heic", "heif"]);

export type TcgLeadStatus = (typeof TCG_LEAD_STATUSES)[number];

export type TcgUploadedPhoto = {
  bucket: string;
  path: string;
  originalName: string;
  contentType: string;
  bytes: number;
};

const trimString = (max: number) =>
  z
    .string()
    .trim()
    .max(max);

const optionalTrimString = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((value) => (value ? value : null));

const attributionString = optionalTrimString(300);

export const TcgAttributionSchema = z.object({
  source: attributionString,
  medium: attributionString,
  campaign: attributionString,
  term: attributionString,
  content: attributionString,
  gclid: attributionString,
  landing_page: attributionString,
  referrer: attributionString,
  first_touch_at: attributionString,
});

export const TcgPhotoSchema = z.object({
  bucket: z.literal(TCG_LEAD_BUCKET),
  path: trimString(500),
  originalName: trimString(180),
  contentType: trimString(120),
  bytes: z.number().int().positive().max(TCG_MAX_PHOTO_BYTES),
});

export const TcgLeadSubmissionSchema = z.object({
  submissionRef: trimString(80).regex(/^[a-zA-Z0-9_-]{12,80}$/),
  full_name: trimString(120).min(2),
  email: trimString(160).email().transform((value) => value.toLowerCase()),
  phone: trimString(60).min(7),
  city: trimString(100).min(2),
  province: trimString(60).min(2),
  card_games: z.array(z.enum(TCG_CARD_GAMES)).min(1).max(TCG_CARD_GAMES.length),
  collection_types: z.array(z.enum(TCG_COLLECTION_TYPES)).min(1).max(TCG_COLLECTION_TYPES.length),
  approximate_card_count: trimString(80).min(1),
  estimated_value: optionalTrimString(80),
  important_items: trimString(2000).min(2),
  condition_notes: optionalTrimString(1600),
  selling_scope: z.enum(["All", "Part", "Unsure"]),
  selling_timeline: z.enum(TCG_SELLING_TIMELINES),
  willing_to_ship: z.enum(["Yes", "No", "Unsure"]),
  additional_details: optionalTrimString(2000),
  photo_paths: z.array(TcgPhotoSchema).min(1).max(TCG_MAX_PHOTO_COUNT),
  consent_confirmed: z.literal(true),
  attribution: TcgAttributionSchema,
});

export type TcgLeadSubmission = z.infer<typeof TcgLeadSubmissionSchema>;

export function sanitizeFilename(name: string) {
  const cleaned = String(name || "photo")
    .replace(/[^a-zA-Z0-9._-]+/g, "_")
    .replace(/_{2,}/g, "_")
    .replace(/^_+|_+$/g, "");
  return cleaned || "photo";
}

export function getExtension(name: string) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match?.[1] || "";
}

export function isAllowedImage(filename: string, contentType: string) {
  return TCG_IMAGE_TYPES.has(String(contentType || "").toLowerCase()) && TCG_IMAGE_EXTENSIONS.has(getExtension(filename));
}

export function assertLeadPhotoPath(submissionRef: string, path: string) {
  const expectedPrefix = `submissions/${submissionRef}/`;
  return path.startsWith(expectedPrefix) && !path.includes("..") && !path.includes("\\");
}

export function makeReference(id: string) {
  const compact = String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
  return compact ? `TCG-${compact}` : "TCG-LEAD";
}
