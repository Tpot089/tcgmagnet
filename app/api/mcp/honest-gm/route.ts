import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/utils/supabase/admin";
import {
  HONEST_GM_RULES,
  HonestGmAccessSchema,
  HonestGmCharacterPatchSchema,
  HonestGmCheckSchema,
  HonestGmDamageSchema,
  HonestGmRecordEventSchema,
  rollDice,
  textToolResult,
} from "@/lib/honestGm";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RpcRequest = {
  jsonrpc?: string;
  id?: string | number | null;
  method?: string;
  params?: Record<string, unknown>;
};

const TOOL_DEFINITIONS = [
  {
    name: "get_world",
    description: "Read the immutable campaign premise, character state, recent canon, recent events, and Honest GM rules. Call this before adjudicating campaign actions that depend on established world facts.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", format: "uuid" },
        access_key: { type: "string", format: "uuid" },
      },
      required: ["campaign_id", "access_key"],
      additionalProperties: false,
    },
  },
  {
    name: "get_canon",
    description: "Search established campaign canon and recent events. Use it whenever continuity or a previously established fact may matter.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", format: "uuid" },
        access_key: { type: "string", format: "uuid" },
        query: { type: "string", maxLength: 200 },
        limit: { type: "integer", minimum: 1, maximum: 100, default: 30 },
      },
      required: ["campaign_id", "access_key"],
      additionalProperties: false,
    },
  },
  {
    name: "record_event",
    description: "Append a material campaign event and any newly established canon facts after they actually occur. Never use this to rewrite the immutable premise.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", format: "uuid" },
        access_key: { type: "string", format: "uuid" },
        event_type: { type: "string", maxLength: 60 },
        summary: { type: "string", maxLength: 4000 },
        details: { type: "object", additionalProperties: true },
        canon_facts: {
          type: "array",
          maxItems: 40,
          items: {
            type: "object",
            properties: {
              category: { type: "string", maxLength: 60 },
              subject: { type: "string", maxLength: 200 },
              fact: { type: "string", maxLength: 4000 },
            },
            required: ["fact"],
            additionalProperties: false,
          },
        },
      },
      required: ["campaign_id", "access_key", "event_type", "summary"],
      additionalProperties: false,
    },
  },
  {
    name: "update_character",
    description: "Merge a shallow JSON patch into the player's canonical character state and optionally record why it changed.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", format: "uuid" },
        access_key: { type: "string", format: "uuid" },
        patch: { type: "object", additionalProperties: true },
        reason: { type: "string", maxLength: 1000 },
      },
      required: ["campaign_id", "access_key", "patch"],
      additionalProperties: false,
    },
  },
  {
    name: "roll_check",
    description: "Perform an honest d20 check after the GM has chosen the DC. The server generates the random roll and records it. Never substitute a narrated or model-generated roll.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", format: "uuid" },
        access_key: { type: "string", format: "uuid" },
        label: { type: "string", maxLength: 200 },
        modifier: { type: "integer", minimum: -100, maximum: 100, default: 0 },
        dc: { type: "integer", minimum: 1, maximum: 100 },
        mode: { type: "string", enum: ["normal", "advantage", "disadvantage"], default: "normal" },
      },
      required: ["campaign_id", "access_key", "label", "dc"],
      additionalProperties: false,
    },
  },
  {
    name: "roll_damage",
    description: "Roll damage or other explicit dice using cryptographically secure randomness and record the result.",
    inputSchema: {
      type: "object",
      properties: {
        campaign_id: { type: "string", format: "uuid" },
        access_key: { type: "string", format: "uuid" },
        label: { type: "string", maxLength: 200 },
        count: { type: "integer", minimum: 1, maximum: 50 },
        sides: { type: "integer", minimum: 2, maximum: 1000 },
        modifier: { type: "integer", minimum: -100, maximum: 100, default: 0 },
      },
      required: ["campaign_id", "access_key", "label", "count", "sides"],
      additionalProperties: false,
    },
  },
];

function rpcResult(id: RpcRequest["id"], result: unknown) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, result }, {
    headers: { "Cache-Control": "no-store" },
  });
}

function rpcError(id: RpcRequest["id"], code: number, message: string, data?: unknown, status = 400) {
  return NextResponse.json({ jsonrpc: "2.0", id: id ?? null, error: { code, message, ...(data === undefined ? {} : { data }) } }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

async function requireCampaign(campaignId: string, accessKey: string) {
  const admin = getSupabaseAdmin();
  const { data, error } = await (admin as any)
    .from("honest_gm_campaigns")
    .select("id,name,premise,premise_hash,character_name,character_state,status,created_at,updated_at")
    .eq("id", campaignId)
    .eq("access_key", accessKey)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Campaign credentials are invalid");
  if (data.status !== "active") throw new Error("Campaign is archived");
  return data;
}

async function callTool(name: string, rawArguments: unknown) {
  const admin = getSupabaseAdmin();
  const args = rawArguments && typeof rawArguments === "object" ? rawArguments : {};

  if (name === "get_world") {
    const parsed = HonestGmAccessSchema.parse(args);
    const campaign = await requireCampaign(parsed.campaign_id, parsed.access_key);
    const [{ data: canon, error: canonError }, { data: events, error: eventsError }] = await Promise.all([
      (admin as any).from("honest_gm_canon").select("created_at,category,subject,fact").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(100),
      (admin as any).from("honest_gm_events").select("created_at,event_type,summary,details").eq("campaign_id", campaign.id).order("created_at", { ascending: false }).limit(50),
    ]);
    if (canonError) throw new Error(canonError.message);
    if (eventsError) throw new Error(eventsError.message);
    return textToolResult({ campaign, rules: HONEST_GM_RULES, canon: canon || [], recent_events: events || [] });
  }

  if (name === "get_canon") {
    const parsed = HonestGmAccessSchema.extend({
      query: HonestGmAccessSchema.shape.campaign_id.optional().transform(() => undefined),
    }).safeParse(args);
    const base = HonestGmAccessSchema.parse(args);
    await requireCampaign(base.campaign_id, base.access_key);
    const input = args as Record<string, unknown>;
    const query = typeof input.query === "string" ? input.query.trim().slice(0, 200) : "";
    const limit = Math.min(Math.max(Number(input.limit) || 30, 1), 100);
    let canonQuery = (admin as any).from("honest_gm_canon").select("created_at,category,subject,fact").eq("campaign_id", base.campaign_id).order("created_at", { ascending: false }).limit(limit);
    if (query) canonQuery = canonQuery.or(`subject.ilike.%${query.replace(/[,%]/g, "")}%,fact.ilike.%${query.replace(/[,%]/g, "")}%`);
    const { data: canon, error } = await canonQuery;
    if (error) throw new Error(error.message);
    const { data: events, error: eventError } = await (admin as any).from("honest_gm_events").select("created_at,event_type,summary,details").eq("campaign_id", base.campaign_id).order("created_at", { ascending: false }).limit(Math.min(limit, 30));
    if (eventError) throw new Error(eventError.message);
    void parsed;
    return textToolResult({ query, canon: canon || [], recent_events: events || [] });
  }

  if (name === "record_event") {
    const parsed = HonestGmRecordEventSchema.parse(args);
    await requireCampaign(parsed.campaign_id, parsed.access_key);
    const { data, error } = await (admin as any).rpc("honest_gm_record_event", {
      p_campaign_id: parsed.campaign_id,
      p_event_type: parsed.event_type,
      p_summary: parsed.summary,
      p_details: parsed.details,
      p_canon_facts: parsed.canon_facts,
    });
    if (error) throw new Error(error.message);
    return textToolResult({ recorded: true, event_id: data, canon_facts_added: parsed.canon_facts.length });
  }

  if (name === "update_character") {
    const parsed = HonestGmCharacterPatchSchema.parse(args);
    await requireCampaign(parsed.campaign_id, parsed.access_key);
    const { data, error } = await (admin as any).rpc("honest_gm_update_character", {
      p_campaign_id: parsed.campaign_id,
      p_patch: parsed.patch,
      p_reason: parsed.reason || null,
    });
    if (error) throw new Error(error.message);
    return textToolResult({ updated: true, character_state: data });
  }

  if (name === "roll_check") {
    const parsed = HonestGmCheckSchema.parse(args);
    await requireCampaign(parsed.campaign_id, parsed.access_key);
    const count = parsed.mode === "normal" ? 1 : 2;
    const rolls = rollDice(count, 20);
    const selected = parsed.mode === "advantage" ? Math.max(...rolls) : parsed.mode === "disadvantage" ? Math.min(...rolls) : rolls[0];
    const total = selected + parsed.modifier;
    const success = total >= parsed.dc;
    const { error } = await (admin as any).from("honest_gm_rolls").insert({
      campaign_id: parsed.campaign_id,
      roll_kind: "check",
      label: parsed.label,
      die_sides: 20,
      rolls,
      selected_roll: selected,
      modifier: parsed.modifier,
      total,
      dc: parsed.dc,
      success,
      mode: parsed.mode,
      metadata: {},
    });
    if (error) throw new Error(error.message);
    return textToolResult({ label: parsed.label, mode: parsed.mode, rolls, selected_roll: selected, modifier: parsed.modifier, total, dc: parsed.dc, success });
  }

  if (name === "roll_damage") {
    const parsed = HonestGmDamageSchema.parse(args);
    await requireCampaign(parsed.campaign_id, parsed.access_key);
    const rolls = rollDice(parsed.count, parsed.sides);
    const total = rolls.reduce((sum, roll) => sum + roll, 0) + parsed.modifier;
    const { error } = await (admin as any).from("honest_gm_rolls").insert({
      campaign_id: parsed.campaign_id,
      roll_kind: "damage",
      label: parsed.label,
      die_sides: parsed.sides,
      rolls,
      selected_roll: null,
      modifier: parsed.modifier,
      total,
      dc: null,
      success: null,
      mode: `${parsed.count}d${parsed.sides}`,
      metadata: {},
    });
    if (error) throw new Error(error.message);
    return textToolResult({ label: parsed.label, dice: `${parsed.count}d${parsed.sides}`, rolls, modifier: parsed.modifier, total });
  }

  throw new Error(`Unknown tool: ${name}`);
}

export async function GET() {
  return NextResponse.json({
    name: "Honest GM MCP",
    status: "ok",
    protocol: "MCP Streamable HTTP JSON-RPC",
    endpoint: "/api/mcp/honest-gm",
    tools: TOOL_DEFINITIONS.map((tool) => tool.name),
  }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: NextRequest) {
  let body: RpcRequest;
  try {
    body = await request.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }

  if (body.jsonrpc !== "2.0" || !body.method) return rpcError(body.id, -32600, "Invalid Request");

  if (body.method === "initialize") {
    return rpcResult(body.id, {
      protocolVersion: "2025-06-18",
      capabilities: { tools: { listChanged: false } },
      serverInfo: { name: "honest-gm", version: "0.1.0" },
      instructions: HONEST_GM_RULES.join(" "),
    });
  }

  if (body.method === "notifications/initialized") {
    return new NextResponse(null, { status: 202 });
  }

  if (body.method === "ping") return rpcResult(body.id, {});
  if (body.method === "tools/list") return rpcResult(body.id, { tools: TOOL_DEFINITIONS });

  if (body.method === "tools/call") {
    const name = typeof body.params?.name === "string" ? body.params.name : "";
    try {
      const result = await callTool(name, body.params?.arguments);
      return rpcResult(body.id, result);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Tool call failed";
      return rpcResult(body.id, {
        isError: true,
        content: [{ type: "text", text: message }],
      });
    }
  }

  return rpcError(body.id, -32601, "Method not found");
}

export async function DELETE() {
  return new NextResponse(null, { status: 204 });
}
