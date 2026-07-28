import { NextResponse } from "next/server";
import { createClient as createServerClient } from "@/utils/supabase/server";
import { hasOpsAccess } from "@/lib/opsAccess";

type AuthenticatedUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    role?: string | null;
  } | null;
};

export type OpsAuthContext = {
  user: AuthenticatedUser | null;
  status: 401 | 403 | null;
  code: "unauthorized" | "forbidden" | null;
  message: string | null;
};

export async function getOpsAuthContext(): Promise<OpsAuthContext> {
  const sb = await createServerClient();
  const { data } = await sb.auth.getUser();
  const user = (data?.user || null) as AuthenticatedUser | null;
  if (!user) {
    return {
      user: null,
      status: 401,
      code: "unauthorized",
      message: "Authentication required",
    };
  }
  if (!hasOpsAccess(user)) {
    return {
      user: null,
      status: 403,
      code: "forbidden",
      message: "Ops access required",
    };
  }
  return { user, status: null, code: null, message: null };
}

export function opsAuthErrorResponse(auth: OpsAuthContext, message?: string) {
  const status = auth.status || 403;
  const code = auth.code || "forbidden";
  return NextResponse.json(
    {
      ok: false,
      code,
      error: message || auth.message || "Ops access required",
    },
    { status }
  );
}

export async function logOpsAuditEvent(event: {
  actor_user_id?: string | null;
  actor_email?: string | null;
  action: string;
  metadata?: Record<string, unknown> | null;
}) {
  console.info("[ops_audit]", {
    actor_user_id: event.actor_user_id || null,
    actor_email: event.actor_email || null,
    action: event.action,
    metadata: event.metadata || {},
  });
}
