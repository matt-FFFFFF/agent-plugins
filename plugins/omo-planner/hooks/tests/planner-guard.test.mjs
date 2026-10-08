import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { dirname, join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import { decide, isAllowedFile } from "../planner-guard.mjs";

const hookPath = join(dirname(fileURLToPath(import.meta.url)), "..", "planner-guard.mjs");
const ROOT = "/tmp/p";
const PLANNER = "omo-planner:planner";

function runHook(stdin) {
  const env = { ...process.env };
  delete env.CLAUDE_PROJECT_DIR;
  return spawnSync(process.execPath, [hookPath], { input: stdin, encoding: "utf8", env });
}

function write(filePath, agentType, toolName = "Write") {
  const input = { tool_name: toolName, cwd: ROOT, tool_input: { file_path: filePath } };
  return agentType === undefined ? input : { ...input, agent_type: agentType };
}

function assertDenied(result) {
  assert.equal(result.status, 0);
  const out = JSON.parse(result.stdout);
  assert.equal(out.hookSpecificOutput.hookEventName, "PreToolUse");
  assert.equal(out.hookSpecificOutput.permissionDecision, "deny");
  assert.equal(typeof out.hookSpecificOutput.permissionDecisionReason, "string");
}

function assertAllowed(result) {
  assert.equal(result.status, 0);
  assert.equal(result.stdout, "");
}

describe("isAllowedFile (upstream path-policy parity)", () => {
  const cases = [
    [".omo/plans/x.md", true],
    [".omo/drafts/y.md", true],
    [".omo/x.MD", true],
    [".OMO/plans/work-plan.md", true],
    [".omo\\plans\\work-plan.md", true],
    [".omo\\plans/work-plan.MD", true],
    ["src/.omo/plans/x.md", true],
    ["my-project/.omo\\plans/task.md", true],
    [`${ROOT}/.omo/drafts/y.md`, true],
    [".omo/plans/x.ts", false],
    ["../.omo/x.md", false],
    [".omo/../secrets.md", false],
    ["/other/project/.omo/plans/x.md", false],
    ["work.omo/plans/x.md", false],
    [".omo-backup/plans/x.md", false],
    ["README.md", false],
    ["my-project\\src\\code.ts", false],
  ];
  for (const [filePath, expected] of cases) {
    test(`${filePath} -> ${expected ? "allowed" : "denied"}`, () => {
      assert.equal(isAllowedFile(filePath, ROOT), expected);
    });
  }
});

describe("decide", () => {
  test("Rule A denies planner write outside .omo and names the path", () => {
    const reason = decide(write("src/a.ts", PLANNER), {});
    assert.ok(reason?.includes("(attempted: src/a.ts)"));
  });

  test("Rule A denies planner write with no path", () => {
    assert.notEqual(decide({ tool_name: "Write", agent_type: PLANNER, cwd: ROOT, tool_input: {} }, {}), null);
  });

  test("Rule A denies planner write with non-string file_path", () => {
    assert.notEqual(decide({ tool_name: "Write", agent_type: PLANNER, cwd: ROOT, tool_input: { file_path: 5 } }, {}), null);
  });

  test("Rule A uses CLAUDE_PROJECT_DIR over cwd as workspace root", () => {
    const input = write("/proj/.omo/plans/x.md", PLANNER);
    assert.equal(decide(input, { CLAUDE_PROJECT_DIR: "/proj" }), null);
    assert.notEqual(decide(input, {}), null);
  });

  test("Rule B denies spawning the planner as a subagent", () => {
    const input = { tool_name: "Task", tool_input: { subagent_type: PLANNER } };
    assert.ok(decide(input, {})?.startsWith("omo-planner:planner must run in the main conversation"));
  });

  test("non-gated tool (Bash) from planner is allowed", () => {
    assert.equal(decide({ tool_name: "Bash", agent_type: PLANNER, tool_input: { command: "rm -rf x" } }, {}), null);
  });
});

describe("hook process", () => {
  test("planner Write src/a.ts -> deny JSON", () => {
    assertDenied(runHook(JSON.stringify(write("src/a.ts", PLANNER))));
  });

  test("planner Write .omo/plans/x.md -> empty stdout", () => {
    assertAllowed(runHook(JSON.stringify(write(".omo/plans/x.md", PLANNER))));
  });

  test("planner Edit .omo/plans/x.ts (extension spoof) -> deny", () => {
    assertDenied(runHook(JSON.stringify(write(".omo/plans/x.ts", PLANNER, "Edit"))));
  });

  test("planner Write .omo/x.MD (uppercase extension) -> allowed", () => {
    assertAllowed(runHook(JSON.stringify(write(".omo/x.MD", PLANNER))));
  });

  test("planner Write ../.omo/x.md (traversal) -> deny", () => {
    assertDenied(runHook(JSON.stringify(write("../.omo/x.md", PLANNER))));
  });

  test("planner Write absolute path inside root .omo/drafts/y.md -> allowed", () => {
    assertAllowed(runHook(JSON.stringify(write(`${ROOT}/.omo/drafts/y.md`, PLANNER))));
  });

  test("planner Write non-string file_path 5 -> deny JSON", () => {
    const input = { tool_name: "Write", agent_type: PLANNER, cwd: ROOT, tool_input: { file_path: 5 } };
    assertDenied(runHook(JSON.stringify(input)));
  });

  test("planner NotebookEdit nb.ipynb -> deny", () => {
    const input = { tool_name: "NotebookEdit", agent_type: PLANNER, cwd: ROOT, tool_input: { notebook_path: "nb.ipynb" } };
    assertDenied(runHook(JSON.stringify(input)));
  });

  test("agent_type absent + Write src/a.ts -> empty", () => {
    assertAllowed(runHook(JSON.stringify(write("src/a.ts", undefined))));
  });

  test("agent_type omo-planner:codebase-explorer + Write src/a.ts -> empty", () => {
    assertAllowed(runHook(JSON.stringify(write("src/a.ts", "omo-planner:codebase-explorer"))));
  });

  test("agent_type bare planner (user's own agent) + Write src/a.ts -> empty", () => {
    assertAllowed(runHook(JSON.stringify(write("src/a.ts", "planner"))));
  });

  test("Agent with subagent_type omo-planner:planner (no agent_type) -> deny", () => {
    assertDenied(runHook(JSON.stringify({ tool_name: "Agent", tool_input: { subagent_type: PLANNER } })));
  });

  test("Agent with subagent_type omo-planner:gap-analyst -> empty", () => {
    assertAllowed(runHook(JSON.stringify({ tool_name: "Agent", tool_input: { subagent_type: "omo-planner:gap-analyst" } })));
  });

  test("stdin not json -> fail-open exit 0, empty stdout, stderr unreadable", () => {
    const result = runHook("not json");
    assertAllowed(result);
    assert.match(result.stderr, /unreadable/);
  });

  test("stdin JSON null -> fail-open exit 0, empty stdout", () => {
    assertAllowed(runHook("null"));
  });
});
