import type { TcgLeadSubmission } from "@/lib/tcgMagnet";

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function list(values: string[]) {
  return values.length ? values.join(", ") : "Not provided";
}

export function buildTcgLeadNotificationEmail(args: {
  lead: TcgLeadSubmission;
  leadId: string;
  reference: string;
  leadUrl?: string | null;
}) {
  const { lead, leadId, reference, leadUrl } = args;
  const subject = `New TCG Magnet collection submission: ${reference}`;
  const rows = [
    ["Reference", reference],
    ["Seller", lead.full_name],
    ["Email", lead.email],
    ["Phone", lead.phone],
    ["Location", `${lead.city}, ${lead.province}`],
    ["Card games", list(lead.card_games)],
    ["Collection types", list(lead.collection_types)],
    ["Approximate card count", lead.approximate_card_count],
    ["Estimated value", lead.estimated_value || "Not provided"],
    ["Timeline", lead.selling_timeline],
    ["Selling scope", lead.selling_scope],
    ["Willing to ship", lead.willing_to_ship],
    ["Uploaded photos", String(lead.photo_paths.length)],
    ["Lead ID", leadId],
  ];

  const htmlRows = rows
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;font-weight:700;">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;">${escapeHtml(value)}</td></tr>`
    )
    .join("");

  const html = `
    <div style="font-family:Arial,sans-serif;color:#111827;line-height:1.5;">
      <h1 style="font-size:20px;margin:0 0 12px;">New TCG Magnet collection submission</h1>
      <table style="border-collapse:collapse;width:100%;max-width:720px;border:1px solid #e5e7eb;">${htmlRows}</table>
      <h2 style="font-size:16px;margin:20px 0 8px;">Important cards or products</h2>
      <p style="white-space:pre-wrap;margin:0 0 14px;">${escapeHtml(lead.important_items)}</p>
      <h2 style="font-size:16px;margin:20px 0 8px;">Condition notes</h2>
      <p style="white-space:pre-wrap;margin:0 0 14px;">${escapeHtml(lead.condition_notes || "Not provided")}</p>
      <h2 style="font-size:16px;margin:20px 0 8px;">Additional details</h2>
      <p style="white-space:pre-wrap;margin:0 0 14px;">${escapeHtml(lead.additional_details || "Not provided")}</p>
      ${leadUrl ? `<p><a href="${escapeHtml(leadUrl)}">View this lead in the internal portal</a></p>` : ""}
    </div>
  `;

  const text = [
    "New TCG Magnet collection submission",
    `Reference: ${reference}`,
    `Seller: ${lead.full_name}`,
    `Email: ${lead.email}`,
    `Phone: ${lead.phone}`,
    `Location: ${lead.city}, ${lead.province}`,
    `Card games: ${list(lead.card_games)}`,
    `Collection types: ${list(lead.collection_types)}`,
    `Estimated value: ${lead.estimated_value || "Not provided"}`,
    `Timeline: ${lead.selling_timeline}`,
    `Willing to ship: ${lead.willing_to_ship}`,
    `Uploaded photos: ${lead.photo_paths.length}`,
    leadUrl ? `Lead URL: ${leadUrl}` : "",
    "",
    "Important cards or products:",
    lead.important_items,
    "",
    "Condition notes:",
    lead.condition_notes || "Not provided",
    "",
    "Additional details:",
    lead.additional_details || "Not provided",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return { subject, html, text };
}
