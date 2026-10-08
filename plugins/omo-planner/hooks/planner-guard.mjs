// planner-guard: PreToolUse hook for the omo-planner plugin.
// Port of oh-my-openagent prometheus-md-only (path-policy.ts) adapted to
// Claude Code hook I/O. Fail-open on unreadable input; always exits 0 and
// signals denial through the JSON permissionDecision instead of exit code 2.
import { isAbsolute, relative, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const PLANNER_AGENT_TYPES = new Set(["omo-planner:planner"]);
const WRITE_TOOLS = new Set(["Write", "Edit", "MultiEdit", "NotebookEdit"]);
const SPAWN_TOOLS = new Set(["Agent", "Task"]);
const ALLOWED_EXTENSIONS = [".md"];

export function isAllowedFile(filePath, workspaceRoot) {
  const resolved = resolve(workspaceRoot, filePath);
  const rel = relative(workspaceRoot, resolved);
  if (rel.startsWith("..") || isAbsolute(rel)) {
    return false;
  }
  if (!/(^|[/\\])\.omo([/\\]|$)/i.test(rel)) {
    return false;
  }
  return ALLOWED_EXTENSIONS.some((ext) => resolved.toLowerCase().endsWith(ext.toLowerCase()));
}

export function decide(input, env) {
  if (WRITE_TOOLS.has(input.tool_name) && PLANNER_AGENT_TYPES.has(input.agent_type)) {
    const path = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
    const root = env.CLAUDE_PROJECT_DIR || input.cwd || process.cwd();
    if (typeof path !== "string" || !isAllowedFile(path, root)) {
      return `omo-planner: the planner may only write .md files under .omo/ (attempted: ${path}). Planning never implements - execution happens later in OpenCode via /ulw-execute.`;
    }
    return null;
  }
  if (SPAWN_TOOLS.has(input.tool_name) && PLANNER_AGENT_TYPES.has(input.tool_input?.subagent_type)) {
    return "omo-planner:planner must run in the main conversation - use /omo-planner:plan or start Claude Code with: claude --agent omo-planner:planner. As a subagent it cannot interview you or hold the approval gate.";
  }
  return null;
}

async function main() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  let input;
  try {
    input = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    process.stderr.write("planner-guard: unreadable hook input, allowing\n");
    process.exit(0);
  }
  if (input === null || typeof input !== "object") {
    process.stderr.write("planner-guard: unreadable hook input, allowing\n");
    process.exit(0);
  }
  const reason = decide(input, process.env);
  if (reason) {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: "PreToolUse",
          permissionDecision: "deny",
          permissionDecisionReason: reason,
        },
      }),
    );
  }
  process.exit(0);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    process.stderr.write(`planner-guard: internal error, allowing: ${String(error)}\n`);
    process.exit(0);
  });
}
