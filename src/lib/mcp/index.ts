import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listWorkspaces, { listChannelMessages } from "./tools/workspaces";
import { listTasks, createTask, updateTaskStatus } from "./tools/tasks";
import { listMemories, addMemory } from "./tools/memory";

// The OAuth issuer must be the direct Supabase host — the project ref is the
// only Supabase value that survives publish unchanged.
const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "gkyiievzkkopzuloqukt";

export default defineMcp({
  name: "coithub-mcp",
  title: "Coithub",
  version: "0.1.0",
  instructions:
    "Tools for a Coithub workspace: read channels and messages, manage the task board, and read or extend the shared memory the AI agents rely on. All calls act as the signed-in user.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [
    listWorkspaces,
    listChannelMessages,
    listTasks,
    createTask,
    updateTaskStatus,
    listMemories,
    addMemory,
  ],
});
