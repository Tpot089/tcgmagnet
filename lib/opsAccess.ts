type UserLike = {
  email?: string | null;
  user_metadata?: {
    role?: string | null;
  } | null;
};

function normalizeEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export function parseEmailAllowlist(raw: unknown) {
  return new Set(
    String(raw || "")
      .split(",")
      .map((entry) => normalizeEmail(entry))
      .filter(Boolean)
  );
}

export function hasOpsAccess(user: UserLike | null | undefined, opsAllowlistRaw?: unknown) {
  if (!user) return false;
  const role = normalizeEmail(user.user_metadata?.role);
  const emailLower = normalizeEmail(user.email);
  const opsAllowlist = parseEmailAllowlist(opsAllowlistRaw ?? process.env.NEXT_PUBLIC_OPS_ALLOWLIST);
  return role === "ops" || opsAllowlist.has(emailLower);
}

export function hasOpsAdminAccess(user: UserLike | null | undefined, opsAdminEmailsRaw?: unknown) {
  if (!user) return false;
  const emailLower = normalizeEmail(user.email);
  const opsAdminEmails = parseEmailAllowlist(opsAdminEmailsRaw ?? process.env.OPS_ADMIN_EMAILS);
  return opsAdminEmails.has(emailLower);
}
