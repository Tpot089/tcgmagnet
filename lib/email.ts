type EmailArgs = { to: string; subject: string; html: string; text?: string; from?: string };

export async function sendEmail(args: EmailArgs) {
  const token = process.env.POSTMARK_SERVER_TOKEN;
  const from =
    typeof args.from === "string" && args.from.trim()
      ? args.from.trim()
      : process.env.POSTMARK_FROM_EMAIL;
  const replyTo = process.env.POSTMARK_REPLY_TO || undefined;

  if (!token) return { ok: false, error: "Missing POSTMARK_SERVER_TOKEN" };
  if (!from || typeof from !== "string") return { ok: false, error: "Missing POSTMARK_FROM_EMAIL" };

  const res = await fetch("https://api.postmarkapp.com/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      "X-Postmark-Server-Token": token,
    },
    body: JSON.stringify({
      From: from,
      To: args.to,
      Subject: args.subject,
      HtmlBody: args.html,
      TextBody: args.text || undefined,
      ReplyTo: replyTo,
      MessageStream: "outbound",
    }),
  });

  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) return { ok: false, error: json?.Message || "postmark_error", status: res.status };
  return { ok: true, messageId: json?.MessageID || null };
}
