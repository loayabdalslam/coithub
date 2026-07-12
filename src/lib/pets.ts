// Backwards-compatible bridge from the old "pet" naming to the AGENTS catalog.
// The chat backend, pet_configs table, and messages.pet_id column all still
// reference slugs — we simply source the list of valid slugs and personality
// prompts from AGENTS now.

import { AGENTS, AGENT_LIST, type AgentSlug } from "./agents";

export type PetSlug = AgentSlug;

export const PET_LIST: PetSlug[] = AGENT_LIST;

export const PET_PROMPTS: Record<PetSlug, { name: string; role: string; system: string }> =
  Object.fromEntries(
    AGENT_LIST.map((slug) => [
      slug,
      { name: AGENTS[slug].name, role: AGENTS[slug].role, system: AGENTS[slug].system },
    ]),
  ) as Record<PetSlug, { name: string; role: string; system: string }>;

const MENTION_RE = new RegExp(`@(${AGENT_LIST.join("|")})\\b`, "gi");

export function detectMentionedPets(body: string): PetSlug[] {
  const found = new Set<PetSlug>();
  for (const m of body.matchAll(MENTION_RE)) {
    found.add(m[1].toLowerCase() as PetSlug);
  }
  return Array.from(found);
}
