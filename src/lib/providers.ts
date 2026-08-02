// AI provider catalog. Every provider requires a workspace API key supplied by
// an admin via Settings → API Keys. The Lovable AI Gateway is not used — the
// provider selected in the frontend drives which API is called.

export type ProviderId =
  | "google" // Gemini via Google AI Studio key
  | "openai" // OpenAI via your OpenAI key
  | "openrouter" // BYO OpenRouter key
  | "groq" // BYO Groq key
  | "gemini" // BYO Google AI Studio key
  | "chatgpt"; // BYO OpenAI key

export type ProviderMode = "byo";

export type ProviderMeta = {
  name: string;
  blurb: string;
  mode: ProviderMode;
  keyLabel?: string;
  keyHelp?: string;
  keyUrl?: string;
};

export const PROVIDERS: Record<ProviderId, ProviderMeta> = {
  google: {
    name: "Google Gemini",
    blurb: "Fast, multimodal. Call Gemini with your Google AI Studio key.",
    mode: "byo",
    keyLabel: "Google AI Studio key",
    keyHelp: "From aistudio.google.com/apikey",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  openai: {
    name: "OpenAI GPT",
    blurb: "Strong reasoning. Call OpenAI with your own API key.",
    mode: "byo",
    keyLabel: "OpenAI API key",
    keyHelp: "Starts with sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
  openrouter: {
    name: "OpenRouter",
    blurb: "Unified access to hundreds of models with your key.",
    mode: "byo",
    keyLabel: "OpenRouter API key",
    keyHelp: "Starts with sk-or-…",
    keyUrl: "https://openrouter.ai/keys",
  },
  groq: {
    name: "Groq",
    blurb: "Ultra-fast open-source models on Groq LPUs.",
    mode: "byo",
    keyLabel: "Groq API key",
    keyHelp: "Starts with gsk_…",
    keyUrl: "https://console.groq.com/keys",
  },
  gemini: {
    name: "Google AI Studio (direct)",
    blurb: "Call Gemini directly with your Google AI Studio key.",
    mode: "byo",
    keyLabel: "Google AI Studio key",
    keyHelp: "From aistudio.google.com/apikey",
    keyUrl: "https://aistudio.google.com/apikey",
  },
  chatgpt: {
    name: "OpenAI (direct)",
    blurb: "Call ChatGPT directly with your own OpenAI key.",
    mode: "byo",
    keyLabel: "OpenAI API key",
    keyHelp: "Starts with sk-…",
    keyUrl: "https://platform.openai.com/api-keys",
  },
};

export type ModelOption = {
  id: string;
  label: string;
  provider: ProviderId;
  tag?: "fast" | "smart" | "cheap";
  description: string;
};

export const MODELS: ModelOption[] = [
  // Google AI Studio (BYO key)
  { id: "google/gemini-3-flash", label: "Gemini 3 Flash", provider: "google", tag: "fast", description: "Latest fast multimodal Gemini." },
  { id: "google/gemini-3-pro", label: "Gemini 3 Pro", provider: "google", tag: "smart", description: "Deepest Gemini reasoning." },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", provider: "google", tag: "cheap", description: "Cheap, high volume." },
  // OpenAI
  { id: "openai/gpt-5.2-mini", label: "GPT-5.2 Mini", provider: "openai", tag: "fast", description: "Balanced OpenAI." },
  { id: "openai/gpt-5.2", label: "GPT-5.2", provider: "openai", tag: "smart", description: "Frontier OpenAI reasoning." },
  // OpenRouter (BYO) — model ids as OpenRouter expects
  { id: "openrouter/anthropic/claude-sonnet-4.5", label: "Claude Sonnet 4.5", provider: "openrouter", tag: "smart", description: "Via OpenRouter." },
  { id: "openrouter/meta-llama/llama-4-maverick", label: "Llama 4 Maverick", provider: "openrouter", tag: "fast", description: "Via OpenRouter." },
  { id: "openrouter/deepseek/deepseek-v3.2-exp", label: "DeepSeek V3.2", provider: "openrouter", tag: "cheap", description: "Via OpenRouter." },
  // Groq (BYO)
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", provider: "groq", tag: "fast", description: "Ultra-fast on Groq." },
  { id: "groq/moonshotai/kimi-k2-instruct-0905", label: "Kimi K2 (Groq)", provider: "groq", tag: "smart", description: "Strong tool-calling on Groq." },
  { id: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B (Groq)", provider: "groq", tag: "cheap", description: "Instant replies." },
  // Gemini direct (BYO)
  { id: "gemini/gemini-3-flash", label: "Gemini 3 Flash (direct)", provider: "gemini", tag: "fast", description: "Direct Google AI Studio." },
  { id: "gemini/gemini-3-pro", label: "Gemini 3 Pro (direct)", provider: "gemini", tag: "smart", description: "Direct Google AI Studio." },
  // OpenAI direct (BYO)
  { id: "chatgpt/gpt-5.2-mini", label: "GPT-5.2 Mini (direct)", provider: "chatgpt", tag: "fast", description: "Direct OpenAI key." },
  { id: "chatgpt/gpt-5.2", label: "GPT-5.2 (direct)", provider: "chatgpt", tag: "smart", description: "Direct OpenAI key." },
];

// Groq is the default: fast, tool-calling capable, and the key we ask for
// during onboarding.
export const DEFAULT_MODEL = "groq/llama-3.3-70b-versatile";


export function providerForModel(modelId: string): ProviderId {
  const head = modelId.split("/")[0] as ProviderId;
  return (head in PROVIDERS ? head : "google") as ProviderId;
}

export function findModel(id: string): ModelOption | undefined {
  return MODELS.find((m) => m.id === id);
}

export function isByoProvider(p: ProviderId): boolean {
  return PROVIDERS[p].mode === "byo";
}
