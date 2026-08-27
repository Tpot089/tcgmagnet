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
  "Improvise locally but converge globally: unexplored details may be invented, but the campaign should increasingly deepen the people, conflicts, mysteries, factions, places, and consequences already established instead of continually spawning unrelated major storylines.",
  "Prefer elaborating an existing element over introducing a new world-scale element. New nations, cosmologies, species, magic systems, major historical events, or setting-changing powers may not be introduced unless the premise or established canon reasonably implies them.",
  "Every improvised person, object, encounter, or event must have a plausible in-world reason to be present based on geography, culture, faction membership, relationships, resources, travel, timing, and prior events. Random means unplanned but plausible, never arbitrary.",
  "Characters and factions retain coherent loyalties, hostilities, goals, knowledge, and incentives. Members of opposing factions do not casually cooperate or socialize as allies unless an established or newly discoverable reason explains it, such as diplomacy, coercion, deception, divided loyalty, treachery, shared necessity, or a changed relationship.",
  "Apparent contradictions are allowed only when they represent a real in-world mystery or deception with an underlying explanation. Never use contradiction merely because continuity was forgotten.",
  "Once repeated discoveries and consequences reveal a coherent narrative direction, treat that direction as the campaign's developing reality. Continue exploring its consequences and unresolved questions rather than abandoning it for a succession of unrelated plots.",
  "The player may still abandon, redirect, destroy, or transform that developing story through choices. Narrative convergence never overrides player agency or protects a planned outcome.",
  "Creative details may be invented only when they do not contradict premise, canon, causality, or the developing narrative direction.",
  "When an outcome is uncertain and failure has meaningful consequences, set the DC before rolling.",
  "Never invent or reroll a mechanical result. Use roll_check or roll_damage and narrate the returned result.",
  "Do not force a prepared plot. NPCs and factions may have goals, but player choices and mechanical outcomes determine what happens.",
  "Record material discoveries, deaths, alliances, betrayals, injuries, item changes, relationship changes, faction changes, mysteries, and world-changing consequences after they occur so future improvisation remains anchored to them.",
] as const;
