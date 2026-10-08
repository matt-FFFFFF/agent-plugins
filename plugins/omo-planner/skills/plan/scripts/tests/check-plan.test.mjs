import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, symlinkSync, rmSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { checkPlanText, main, readPlan } from "../check-plan.mjs";
import { buildPlanSkeleton } from "../plan-templates.mjs";

const fixture = readFileSync(new URL("./fixtures/valid-plan.md", import.meta.url), "utf8");
const checker = fileURLToPath(new URL("../check-plan.mjs", import.meta.url));
const mutations = [
  ["R1", "TL;DR removed", (s) => s.replace("## TL;DR (For humans)\n", "")],
  ["R1", "TL;DR trailing space", (s) => s.replace("## TL;DR (For humans)\n", "## TL;DR (For humans) \n")],
  ["R2", "headers swapped", (s) => s.replace("## Scope", "## Verification strategy").replace("## Verification strategy\nRun", "## Scope\nRun")],
  ["R2", "duplicate header", (s) => s + "\n## Scope\n"],
  ["R3", "noncontiguous label", (s) => s.replace("2. Prepare", "4. Prepare")],
  ["R3", "duplicate label", (s) => s.replace("2. Prepare", "1. Prepare")],
  ["R3", "T label", (s) => s.replace("2. Prepare", "T2. Prepare")],
  ["R3", "leading zero label", (s) => s.replace("2. Prepare", "02. Prepare")],
  ["R3", "star row", (s) => s.replace("- [ ] 2.", "* [ ] 2.")],
  ["R3", "malformed checkbox", (s) => s.replace("- [ ] 2.", "-[ ] 2.")],
  ["R4", "F3 removed", (s) => s.replace("- [ ] F3. Real manual QA\n", "")],
  ["R4", "invalid final row", (s) => s.replace("F3.", "F03.")],
  ["R4", "extra invalid final row", (s) => s.replace("## Commit strategy", "- [ ] Z1. bad\n\n## Commit strategy")],
  ["R5", "git category", (s) => s.replace("category: quick", "category: git")],
  ["R5", "deep category", (s) => s.replace("category: quick", "category: deep")],
  ["R5", "Commit removed", (s) => s.replace("  Commit: Y | Prepare inputs\n", "")],
  ["R5", "Commit placeholder", (s) => s.replace("Commit: Y | Prepare inputs", "Commit: <Y/N> | x")],
  ["R5", "Commit whole word", (s) => s.replace("Commit: Y |", "Commit: Yes |")],
  ["R5", "duplicate category", (s) => s.replace("  References: inputs.md", "  Recommended task executor category: quick\n  References: inputs.md")],
  ["R5", "duplicate Parallelization", (s) => s.replace("  References: inputs.md", "  Parallelization: Wave 1 | Blocked by: none | Blocks: 3\n  References: inputs.md")],
  ["R5", "heading ends block", (s) => s.replace("  References: inputs.md", "### Notes\n  References: inputs.md")],
  ...["References", "Acceptance criteria", "QA scenarios"].map((label) => ["R5", `${label} missing`, (s) => s.replace(new RegExp(`^  ${label}:.*\\n`, "m"), "")]),
  ["R5", "Parallelization lacks Wave", (s) => s.replace("Parallelization: Wave 1 | Blocked by: none | Blocks: 3", "Parallelization: |")],
  ["R6", "unknown dependency", (s) => s.replace("Blocked by: 1, 2", "Blocked by: 7")],
  ["R6", "unparseable dependency", (s) => s.replace("Blocked by: 1, 2", "Blocked by: two")],
  ["R6", "descending range", (s) => s.replace("Blocked by: 1, 2", "Blocked by: 2-1")],
  ["R6", "unknown parallel cell", (s) => s.replace("| 1 | - | 3 | 2 |", "| 1 | - | 3 | 7 |")],
  ["R6", "unknown range ids", (s) => s.replace("Blocked by: 1, 2", "Blocked by: 1-99")],
  ["R7", "matrix row missing", (s) => s.replace("| 2 | - | 3 | 1 |\n", "")],
  ["R7", "matrix differs", (s) => s.replace("| 3 | 1, 2 |", "| 3 | 1 |")],
  ["R7", "matrix Blocks differs with same size", (s) => s.replace("| 1 | - | 3 | 2 |", "| 1 | - | 2 | 2 |")],
  ["R7", "three-column matrix row", (s) => s.replace("| 1 | - | 3 | 2 |", "| 1 | - | 3 |")],
  ["R7", "malformed matrix row", (s) => s.replace("| 2 | - | 3 | 1 |", "| 2 | - | 3 |")],
  ["R7", "one-way extra Blocks", (s) => s.replace("Blocks: 3", "Blocks: 2, 3").replace("| 1 | - | 3 |", "| 1 | - | 2, 3 |")],
  ["R7", "matrix duplicate", (s) => s.replace("| 2 | - | 3 | 1 |", "| 2 | - | 3 | 1 |\n| 2 | - | 3 | 1 |")],
  ["R7", "asymmetric dependency", (s) => s.replace("Blocks: 3", "Blocks: none").replace("| 1 | - | 3 |", "| 1 | - | - |")],
  ["R7", "dependency cycle", (s) => s.replace("Blocked by: none", "Blocked by: 3").replace("| 1 | - |", "| 1 | 3 |").replace("Blocks: none", "Blocks: 1").replace("| 3 | 1, 2 | - |", "| 3 | 1, 2 | 1 |")],
  ["R8", "wave too early", (s) => s.replace("Parallelization: Wave 2", "Parallelization: Wave 1")],
  ["R8", "waves heading missing", (s) => s.replace("### Parallel execution waves\n", "")],
  ["R9", "Commit strategy empty", (s) => s.replace("Commit each independent change after verification.", "<!-- comment only -->")],
  ["R9", "multiline comment only", (s) => s.replace("Commit each independent change after verification.", "<!--\ncomment only\n-->")],
  ["R10", "placeholder", (s) => s.replace("The demonstration stays local.", "<" + "fill>")],
  ["R11", "duration Effort", (s) => s.replace("**Effort:** Short", "**Effort:** 2 days")],
  ["R11", "Effort mid-line", (s) => s.replace("**Effort:** Short", "Prose **Effort:** Short")],
  ["R12", "IS row missing", (s) => s.replace(/^\| IS-1 .*\n?/m, "")],
];

test("accepts valid fixture when all structural rules hold", () => {
  // Given
  const text = fixture;
  // When
  const result = checkPlanText(text);
  // Then
  assert.deepEqual(result.errors, []);
  assert.deepEqual([...result.todos.keys()], [1, 2, 3]);
});
for (const [rule, condition, mutate] of mutations) test(`${rule} fires when ${condition}`, () => {
  // Given
  const text = mutate(fixture);
  // When
  const { errors } = checkPlanText(text);
  // Then
  assert.ok(errors.some((error) => error.rule === rule), JSON.stringify(errors));
  if (condition === "malformed matrix row") assert.ok(errors.some((error) => error.rule === "R7" && error.message === "matrix row must name one todo and four cells"));
  assert.ok(errors.every((error) => Number.isInteger(error.line) && error.line >= 1));
  if (condition === "dependency cycle") assert.ok(errors.some((error) => error.rule === "R7" && /cycle: 1 -> 3 -> 1/.test(error.message)));
  if (condition === "one-way extra Blocks") assert.ok(errors.some((error) => error.rule === "R7" && error.message === "todo 2 must list 1 in Blocked by"));
});
test("caps recorded errors when more than 200 ids are unparseable", () => {
  // Given
  const text = fixture.replace("Blocked by: 1, 2", `Blocked by: ${Array(250).fill("bad").join(",")}`);
  // When
  const { errors } = checkPlanText(text);
  // Then
  assert.equal(errors.length, 201);
  assert.ok(errors.slice(0, 200).every((error) => error.rule === "R6"));
  assert.deepEqual(errors[200], { rule: "R0", line: 1, message: "too many errors; stopping" });
});
test("stops checking when 300 todos lack required fields", () => {
  // Given
  const text = "## Todos\n" + Array.from({ length: 300 }, (_, i) => `- [ ] ${i + 1}. task`).join("\n");
  // When
  const { errors } = checkPlanText(text);
  // Then
  assert.equal(errors.length, 201);
  assert.equal(errors.at(-1).rule, "R0");
});
test("rejects huge unknown range when endpoint is maximum safe integer", { timeout: 2000 }, () => {
  // Given
  const text = fixture.replace("Blocked by: 1, 2", "Blocked by: 1-9007199254740991");
  // When
  const { errors } = checkPlanText(text);
  // Then
  assert.ok(errors.some((error) => error.rule === "R6" && /unknown todo id/.test(error.message)));
});
for (const [condition, mutate] of [
  ["prose mentions fields", (s) => s.replace("  References: inputs.md", "  A sentence mentioning `Recommended task executor category` followed by prose.\n  References: inputs.md")],
  ["prose mentions headers", (s) => s.replace("The demonstration stays local.", "See ## Scope > Must have for details.")],
  ["formatted category", (s) => s.replace("  Recommended task executor category: quick", "  - **`Recommended task executor category`**: `quick`")],
  ["ranges and final IDs", (s) => s.replace("Blocked by: 1, 2", "Blocked by: 1-2, F1").replace("| 3 | 1, 2 |", "| 3 | 1-2 |")],
  ["empty dependency markers", (s) => s.replaceAll("Blocked by: none", "Blocked by: —, n/a, , -")],
  ["checked and blocked rows", (s) => s.replace("- [ ] 1.", "- [x] 1.").replace("- [ ] 2.", "- [X] 2.").replace("- [ ] 3.", "- [~] 3.")],
  ["nested checkboxes", (s) => s.replace("  References: inputs.md", "  - [ ] nested detail\n  References: inputs.md")],
  ["longer backtick fence", (s) => s.replace("```md\n- [ ] 9. ignored\n```", "````md\n```js\n- [ ] 9. ignored\n```\n## Scope\n````")],
  ["tilde fence", (s) => s.replaceAll("```", "~~~")],
  ["inline backticks", (s) => s.replace("  References: inputs.md", "```example```\n  References: inputs.md")],
  ["CRLF", (s) => s.replaceAll("\n", "\r\n")],
]) test(`accepts fixture when ${condition}`, () => {
  // Given
  const text = mutate(fixture);
  // When
  const { errors } = checkPlanText(text);
  // Then
  assert.deepEqual(errors, []);
});
for (const text of ["", "garbage", "\u0000\ufffd"]) test(`rejects malformed input when ${JSON.stringify(text)}`, () => {
  // Given: malformed text
  // When
  const { errors } = checkPlanText(text);
  // Then
  for (const rule of ["R1", "R2", "R3", "R4", "R7", "R8", "R9", "R11", "R12"]) assert.ok(errors.some((error) => error.rule === rule));
});
test("rejects skeleton when placeholders remain", () => {
  // Given
  const text = buildPlanSkeleton("demo", "clear");
  // When
  const { errors } = checkPlanText(text);
  // Then
  assert.ok(errors.some((error) => error.rule === "R10"));
});

const processCases = [
  ["digest after path", [".omo/plans/demo.md", "--digest"], 0],
  ["digest before path", ["--digest", ".omo/plans/demo.md"], 0],
  ["JSON flags mixed", ["--json", ".omo/plans/demo.md", "--digest"], 0],
  ["JSON flags first", ["--digest", "--json", ".omo/plans/demo.md"], 0],
  ["JSON flags last", [".omo/plans/demo.md", "--digest", "--json"], 0],
  ["JSON without digest", [".omo/plans/demo.md", "--json"], 0],
  ["default output", [".omo/plans/demo.md"], 0],
  ["normalized path", [".omo/./plans/demo.md"], 0],
  ["unsafe path", ["plans/demo.md"], 2],
  ["missing file", [".omo/plans/missing.md"], 2],
  ["bad slug", [".omo/plans/Bad_Slug.md"], 2],
  ["no path", ["--digest"], 64],
  ["extra path", [".omo/plans/demo.md", "extra"], 64],
  ["unknown flag", [".omo/plans/demo.md", "--x"], 64],
  ["short flag", ["-x"], 64],
  ["structural error", [".omo/plans/demo.md", "--digest", "--json"], 1],
  ["text structural error", [".omo/plans/demo.md", "--digest"], 1],
  ["empty file", [".omo/plans/demo.md"], 1],
  ["oversized file", [".omo/plans/demo.md", "--digest"], 2],
  ["symlink .omo", [".omo/plans/demo.md"], 2],
  ["symlink plans", [".omo/plans/demo.md"], 2],
  ["symlink target", [".omo/plans/demo.md"], 2],
];
for (const [condition, args, status] of processCases) test(`CLI returns ${status} when ${condition}`, (t) => {
  // Given
  const root = mkdtempSync(join(tmpdir(), "check-plan-"));
  t.after(() => rmSync(root, { recursive: true, force: true }));
  mkdirSync(join(root, ".omo/plans"), { recursive: true });
  const text = condition.includes("structural error") ? fixture.replace("category: quick", "category: git") : condition === "empty file" ? "" : fixture;
  writeFileSync(join(root, ".omo/plans/demo.md"), text);
  if (condition === "unsafe path") {
    mkdirSync(join(root, "plans"));
    writeFileSync(join(root, "plans/demo.md"), fixture);
  }
  if (condition === "bad slug") writeFileSync(join(root, ".omo/plans/Bad_Slug.md"), fixture);
  if (condition === "oversized file") truncateSync(join(root, ".omo/plans/demo.md"), 1_048_577);
  if (condition.startsWith("symlink")) {
    const target = condition === "symlink .omo" ? ".omo" : condition === "symlink plans" ? ".omo/plans" : ".omo/plans/demo.md";
    rmSync(join(root, target), { recursive: true });
    const destination = condition === "symlink target" ? join(root, "real.md") : root;
    if (condition === "symlink target") writeFileSync(destination, fixture);
    symlinkSync(destination, join(root, target));
  }
  // When
  const result = spawnSync(process.execPath, [checker, ...args], { cwd: root, encoding: "utf8" });
  // Then
  assert.equal(result.status, status, result.stdout + result.stderr);
  if (status === 2) assert.match(result.stderr, /^INCONCLUSIVE:/);
  if (["unsafe path", "bad slug"].includes(condition) || condition.startsWith("symlink")) assert.match(result.stderr, /plan path must be|symlink/);
  if (condition === "oversized file") assert.match(result.stderr, /^INCONCLUSIVE: plan exceeds 1 MiB\n$/);
  if (status === 64) assert.match(result.stderr, /^Usage:/);
  if (status === 0 || status === 1) {
    const digest = createHash("sha256").update(text).digest("hex");
    if (args.includes("--json")) {
      const output = JSON.parse(result.stdout);
      assert.equal(output.ok, status === 0);
      assert.equal(output.todos, 3);
      assert.equal(output.sha256, status === 0 && args.includes("--digest") ? digest : null);
      assert.equal(output.errors.length === 0, status === 0);
      if (status === 1) assert.ok(output.errors.some((error) => error.rule === "R5"));
    } else if (status === 0) {
      assert.match(result.stdout, /^OK 3 todos, F1-F4 present\n/);
      if (args.includes("--digest")) assert.ok(result.stdout.includes(`sha256 ${digest}  .omo/plans/demo.md\n`));
    } else {
      assert.match(result.stdout, /^ERROR R\d+ line \d+:/);
      assert.ok(!result.stdout.includes("sha256 ") && !result.stdout.includes("OK "));
    }
  }
});

for (const key of ["ino", "size", "mtimeMs"]) test(`returns INCONCLUSIVE when ${key} changes during read`, (t) => {
  // Given
  const stat = { ino: 1, size: 100, mtimeMs: 1, isDirectory: () => true, isFile: () => true };
  let calls = 0;
  const io = { lstatSync: () => (++calls === 4 ? { ...stat, [key]: 2 } : stat), readFileSync: () => Buffer.from(fixture) };
  const messages = [];
  t.mock.method(console, "error", (message) => messages.push(message));
  // When
  const status = main([".omo/plans/demo.md", "--digest"], io);
  // Then
  assert.equal(status, 2);
  assert.deepEqual(messages, ["INCONCLUSIVE: changed during read"]);
});
test("reads bytes exactly once when file is stable", () => {
  // Given
  const stat = { ino: 1, size: 100, mtimeMs: 1, isDirectory: () => true, isFile: () => true };
  let reads = 0;
  const io = { lstatSync: () => stat, readFileSync: () => { reads++; return Buffer.from(fixture); } };
  // When
  const plan = readPlan(".omo/plans/demo.md", io);
  // Then
  assert.equal(reads, 1);
  assert.equal(plan.bytes.toString(), fixture);
});
