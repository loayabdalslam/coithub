// Small helpers shared by Composio server functions. Contains no server-only
// imports so it is safe to import from *.functions.ts module scope.

export function composioUserId(workspaceId: string): string {
  return `ws_${workspaceId}`;
}

type RpcClient = { rpc: (fn: never, args: never) => Promise<{ data: unknown }> };

export async function composioKeyFor(supabase: RpcClient, workspaceId: string): Promise<string> {
  const { data } = await supabase.rpc("get_workspace_api_key" as never, {
    _workspace_id: workspaceId,
    _provider: "composio",
  } as never);
  const key = (data as string | null) ?? null;
  if (!key) {
    throw new Error(
      "No Composio API key for this workspace. An admin can add one in Settings → Integrations.",
    );
  }
  return key;
}

export function humanizeTool(slug: string, toolkit: string): string {
  const parts = slug.split("_");
  if (parts[0]?.toLowerCase() === toolkit.replace(/_/g, "").toLowerCase()) parts.shift();
  const words = parts.join(" ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}

export function examplePrompt(slug: string, toolkit: string): string {
  const action = humanizeTool(slug, toolkit).toLowerCase();
  const app = toolkit.replace(/_/g, " ");
  return `@co ${action} in ${app} — `;
}

/**
 * Curated "most used" Composio toolkits with ready-to-send prompts. Used by the
 * "!" palette to recommend tools before (or alongside) live connected tools.
 */
export const RECOMMENDED_TOOLKITS: {
  slug: string;
  label: string;
  prompts: string[];
}[] = [
  { slug: "gmail", label: "Gmail", prompts: ["@co summarise my 5 latest unread emails — ", "@co draft a reply to the last email from — "] },
  { slug: "googlecalendar", label: "Google Calendar", prompts: ["@co what's on my calendar today? — ", "@co schedule a 30 min sync tomorrow with — "] },
  { slug: "slack", label: "Slack", prompts: ["@co post a standup summary to #general — ", "@co find recent Slack messages about — "] },
  { slug: "github", label: "GitHub", prompts: ["@co list my open pull requests — ", "@co create an issue titled — "] },
  { slug: "notion", label: "Notion", prompts: ["@co create a Notion page for this project — ", "@co find Notion docs about — "] },
  { slug: "linear", label: "Linear", prompts: ["@co create a Linear issue for — ", "@co list my assigned Linear issues — "] },
  { slug: "googlesheets", label: "Google Sheets", prompts: ["@co add a row to my tracker sheet — ", "@co summarise the data in sheet — "] },
  { slug: "googledrive", label: "Google Drive", prompts: ["@co find the latest file about — ", "@co share this doc with — "] },
];

export const COMPOSIO_SIGNUP_URL = "https://platform.composio.dev/developers";
