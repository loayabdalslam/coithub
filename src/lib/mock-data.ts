import { AGENTS, AGENT_LIST, type AgentSlug } from "./agents";

// Alias kept so existing consumers (Sidebar, mock messages) still compile.
export type PetId = AgentSlug;

export const PETS = Object.fromEntries(
  AGENT_LIST.map((slug) => [
    slug,
    {
      id: slug,
      name: AGENTS[slug].name,
      role: AGENTS[slug].role,
      mission: AGENTS[slug].mission,
      color: AGENTS[slug].color,
      initials: AGENTS[slug].name.slice(0, 2).toUpperCase(),
    },
  ]),
) as Record<PetId, {
  id: PetId;
  name: string;
  role: string;
  mission: string;
  color: string;
  initials: string;
}>;

export const CHANNELS = [
  { id: "general", name: "general", topic: "Company-wide chatter" },
  { id: "product", name: "product", topic: "Roadmap, PRDs, decisions" },
  { id: "engineering", name: "engineering", topic: "Architecture and code" },
  { id: "design", name: "design", topic: "Flows, mocks, critique" },
  { id: "research", name: "research", topic: "Market + user insights" },
];

export type MockMessage = {
  id: string;
  author: { kind: "human"; name: string; initials: string } | { kind: "pet"; petId: PetId };
  time: string;
  body: string;
  attachments?: { kind: "task" | "decision" | "delegation"; title: string; meta?: string }[];
};

export const CHANNEL_MESSAGES: Record<string, MockMessage[]> = {
  product: [],
  general: [],
  engineering: [],
  design: [],
  research: [],
};

export const TASKS = [
  { id: "T-101", title: "Draft onboarding v2 PRD", owner: "Nova", status: "In progress", priority: "P1" },
  { id: "T-102", title: "Provider autodetection", owner: "Cody", status: "Backlog", priority: "P1" },
  { id: "T-103", title: "Onboarding flow mockups", owner: "Pixel", status: "In progress", priority: "P2" },
  { id: "T-104", title: "Competitor recap — weekly", owner: "Scout", status: "Done", priority: "P3" },
  { id: "T-105", title: "Workspace-level AI budget policy", owner: "Cody", status: "Blocked", priority: "P1" },
];
