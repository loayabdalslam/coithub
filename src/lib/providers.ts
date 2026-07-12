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
    blurb: "Fast, multimodal. Powered by the Lovable AI Gateway.",
    mode: "lovable",
  },
  openai: {
    name: "OpenAI GPT",
    blurb: "Strong reasoning. Powered by the Lovable AI Gateway.",
    mode: "lovable",
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
  // Lovable-gateway Google
  { id: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", provider: "google", tag: "fast", description: "Default. Fast, multimodal." },
  { id: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "google", tag: "smart", description: "Deeper reasoning." },
  { id: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", provider: "google", tag: "cheap", description: "Cheapest, high volume." },
  // Lovable-gateway OpenAI
  { id: "openai/gpt-5-mini", label: "GPT-5 Mini", provider: "openai", tag: "fast", description: "Balanced OpenAI." },
  { id: "openai/gpt-5", label: "GPT-5", provider: "openai", tag: "smart", description: "Strong all-rounder." },
  // OpenRouter (BYO) — model ids as OpenRouter expects
  { id: "openrouter/anthropic/claude-3.5-sonnet", label: "Claude 3.5 Sonnet", provider: "openrouter", tag: "smart", description: "Via OpenRouter." },
  { id: "openrouter/meta-llama/llama-3.3-70b-instruct", label: "Llama 3.3 70B", provider: "openrouter", tag: "fast", description: "Via OpenRouter." },
  { id: "openrouter/deepseek/deepseek-chat", label: "DeepSeek Chat", provider: "openrouter", tag: "cheap", description: "Via OpenRouter." },
  // Groq (BYO)
  { id: "groq/llama-3.3-70b-versatile", label: "Llama 3.3 70B (Groq)", provider: "groq", tag: "fast", description: "Ultra-fast on Groq." },
  { id: "groq/llama-3.1-8b-instant", label: "Llama 3.1 8B (Groq)", provider: "groq", tag: "cheap", description: "Instant replies." },
  // Gemini direct (BYO)
  { id: "gemini/gemini-2.0-flash", label: "Gemini 2.0 Flash (direct)", provider: "gemini", tag: "fast", description: "Direct Google AI Studio." },
  { id: "gemini/gemini-1.5-pro", label: "Gemini 1.5 Pro (direct)", provider: "gemini", tag: "smart", description: "Direct Google AI Studio." },
  // OpenAI direct (BYO)
  { id: "chatgpt/gpt-4o-mini", label: "GPT-4o Mini (direct)", provider: "chatgpt", tag: "fast", description: "Direct OpenAI key." },
  { id: "chatgpt/gpt-4o", label: "GPT-4o (direct)", provider: "chatgpt", tag: "smart", description: "Direct OpenAI key." },
];

export const DEFAULT_MODEL = "google/gemini-3-flash-preview";

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
