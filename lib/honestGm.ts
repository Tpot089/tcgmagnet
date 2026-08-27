import { z } from "zod";

export const HonestGmAccessSchema = z.object({
  campaign_id: z.string().uuid(),
  access_key: z.string().uuid(),
});

export const HonestGmCheckSchema = HonestGmAccessSchema.extend({
  label: z.string().trim().min(1).max(200),
  modifier: z.number().int().min(-100).max(100).default(0),
  dc: z.number().int().min(1).max(100),
  mode: z.enum(["normal", "advantage", "disadvantage"]).default("normal"),
});

export const HonestGmDamageSchema = HonestGmAccessSchema.extend({
  label: z.string().trim().min(1).max(200),
  count: z.number().int().min(1).max(50),
  sides: z.number().int().min(2).max(1000),
  modifier: z.number().int().min(-100).max(100).default(0),
});

export const HonestGmRecordEventSchema = HonestGmAccessSchema.extend({
  event_type: z.string().trim().min(1).max(60),
  summary: z.string().trim().min(1).max(4000),
  details: z.record(z.string(), z.unknown()).default({}),
  canon_facts: z.array(z.object({
    category: z.string().trim().min(1).max(60).default("fact"),
    subject: z.string().trim().min(1).max(200).default("Campaign"),
    fact: z.string().trim().min(1).max(4000),
  })).max(40).default([]),
});

export const HonestGmCharacterPatchSchema = HonestGmAccessSchema.extend({
  patch: z.record(z.string(), z.unknown()),
  reason: z.string().trim().max(1000).optional(),
});

export function secureRandomInt(min: number, max: number) {
  if (!Number.isSafeInteger(min) || !Number.isSafeInteger(max) || min > max) {
    throw new Error("Invalid random integer range");
  }
  const span = max - min + 1;
  if (span > 0x100000000) throw new Error("Random range is too large");

  const limit = Math.floor(0x100000000 / span) * span;
  const values = new Uint32Array(1);
  let value = 0;
  do {
    crypto.getRandomValues(values);
    value = values[0];
  } while (value >= limit);
  return min + (value % span);
}

export function rollDice(count: number, sides: number) {
  return Array.from({ length: count }, () => secureRandomInt(1, sides));
}

export function textToolResult(value: unknown) {
  return {
    content: [{ type: "text", text: JSON.stringify(value, null, 2) }],
    structuredContent: value,
  };
}

export const HONEST_GM_RULES = [
  "The uploaded premise is immutable source truth. Never contradict or rewrite it.",
  "Campaign canon and recorded events are authoritative once established.",
  "Creative details may be invented only when they do not contradict premise or canon.",
  "When an outcome is uncertain and failure has meaningful consequences, set the DC before rolling.",
  "Never invent or reroll a mechanical result. Use roll_check or roll_damage and narrate the returned result.",
  "Do not force a prepared plot. NPCs and factions may have goals, but player choices and mechanical outcomes determine what happens.",
  "Record material discoveries, deaths, alliances, injuries, item changes, and world-changing consequences after they occur.",
] as const;
