import type { ProviderId } from "./providers";

export type ChatMsg = { role: "system" | "user" | "assistant"; content: string };

const throwHttp = async (label: string, resp: Response) => {
  const text = await resp.text().catch(() => "");
  if (resp.status === 429) throw new Error(`${label}: rate limited — try again in a moment.`);
  if (resp.status === 401 || resp.status === 403)
    throw new Error(`${label}: invalid or missing API key.`);
  if (resp.status === 402) throw new Error(`${label}: credits exhausted.`);
  throw new Error(`${label} error ${resp.status}: ${text.slice(0, 300)}`);
};

// Calls the AI provider selected in the frontend using the workspace's own API key.
// The Lovable AI Gateway is not used.
export async function callProvider(
  provider: ProviderId,
  model: string,
  messages: ChatMsg[],
  workspaceKey: string | null,
): Promise<string> {
  // Strip provider prefix — providers expect the raw model id.
  const rawModel = model.includes("/") ? model.split("/").slice(1).join("/") : model;

  if (!workspaceKey) {
    throw new Error(
      `No ${provider} API key configured for this workspace. An admin can add one in Settings → API Keys.`,
    );
  }

  // OpenAI-compatible providers (OpenAI, OpenRouter, Groq).
  const openaiCompatible: Partial<Record<ProviderId, { url: string; label: string; extraHeaders?: Record<string, string> }>> = {
    openai: { url: "https://api.openai.com/v1/chat/completions", label: "OpenAI" },
    chatgpt: { url: "https://api.openai.com/v1/chat/completions", label: "OpenAI" },
    groq: { url: "https://api.groq.com/openai/v1/chat/completions", label: "Groq" },
    openrouter: {
      url: "https://openrouter.ai/api/v1/chat/completions",
      label: "OpenRouter",
      extraHeaders: { "HTTP-Referer": "https://coithub.app", "X-Title": "Coithub" },
    },
  };

  const oa = openaiCompatible[provider];
  if (oa) {
    const resp = await fetch(oa.url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${workspaceKey}`,
        ...(oa.extraHeaders ?? {}),
      },
      body: JSON.stringify({ model: rawModel, messages }),
    });
    if (!resp.ok) await throwHttp(oa.label, resp);
    const json = (await resp.json()) as { choices?: { message?: { content?: string } }[] };
    return json.choices?.[0]?.message?.content?.trim() ?? "";
  }

  // Google providers (Gemini direct via Google AI Studio key).
  if (provider === "google" || provider === "gemini") {
    const sys = messages.filter((m) => m.role === "system").map((m) => m.content).join("\n\n");
    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
      rawModel,
    )}:generateContent?key=${encodeURIComponent(workspaceKey)}`;
    const resp = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: sys ? { parts: [{ text: sys }] } : undefined,
        contents,
      }),
    });
    if (!resp.ok) await throwHttp("Gemini", resp);
    const json = (await resp.json()) as {
      candidates?: { content?: { parts?: { text?: string }[] } }[];
    };
    return json.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("").trim() ?? "";
  }

  throw new Error(`Unknown provider: ${provider}`);
}
