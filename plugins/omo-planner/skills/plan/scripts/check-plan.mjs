import * as fs from "node:fs";
import { createHash } from "node:crypto";
import { relative, resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
import { PLAN_SECTION_HEADERS } from "./plan-templates.mjs";

// copied from oh-my-openagent boulder-state/src/plan-checklist.ts - keep in sync
const TODO_HEADING_PATTERN = /^##[ \t]+TODOs(?:[ \t]+#+)?[ \t]*$/i;
const FINAL_VERIFICATION_HEADING_PATTERN =
  /^##[ \t]+Final Verification Wave(?:[ \t]+#+)?[ \t]*$/i;
const SECTION_BOUNDARY_HEADING_PATTERN = /^#{1,2}(?:[ \t]+|$)/;
const STRUCTURED_CHECKBOX_PATTERN = /^- \[([ xX~])\] (.+)$/;
const TODO_TASK_LABEL_PATTERN =
  /^([1-9]\d*|T[1-9]\d*(?:\.[1-9]\d*[a-z]?)?)(?:\.[ \t]+|[ \t]+(?:[-\u2014][ \t]+)?)(.+)$/i;
const FINAL_WAVE_TASK_LABEL_PATTERN =
  /^([FH][1-9]\d*(?:\.[1-9]\d*[a-z]?)?)(?:\.[ \t]+|[ \t]+(?:[-\u2014][ \t]+)?)(.+)$/i;
const FENCE_PATTERN = /^[ \t]{0,3}(`{3,}|~{3,})(.*)$/;

// Ported from boulder-state/src/markdown-fence.ts; TypeScript types stripped.
function parseOpeningFence(line) {
  const match = line.match(FENCE_PATTERN);
  const run = match?.[1];
  const info = match?.[2];
  const marker = run?.charAt(0);
  if (
    run === undefined ||
    info === undefined ||
    (marker !== "`" && marker !== "~") ||
    (marker === "`" && info.includes("`"))
  ) {
    return null;
  }
  return { marker, length: run.length };
}
function isClosingFence(line, fence) {
  const run = line.match(/^[ \t]{0,3}(`{3,}|~{3,})[ \t]*$/)?.[1];
  return run?.charAt(0) === fence.marker && run.length >= fence.length;
}

const CATEGORIES = new Set(["quick", "unspecified-low", "unspecified-high", "visual-engineering", "artistry", "writing", "deep-low", "deep-high", "ultrabrain"]);
const CHECKBOX = /^[-*][ \t]*\[/;
const field = (label) => new RegExp("^\\s*(?:[-*]\\s+)?[*`]*" + label + "\\b", "i");
const value = (text, label) => text.replace(field(label), "").replace(/^[*`:\s]+/, "");
const equalSets = (a, b) => a.size === b.size && [...a].every((id) => b.has(id));
const STOP = Symbol("stop");

export function checkPlanText(text) {
  const errors = [], todos = new Map(), visible = [], finals = new Set();
  const error = (rule, line, message) => {
    if (errors.length < 200) errors.push({ rule, line, message });
    else {
      errors.push({ rule: "R0", line: 1, message: "too many errors; stopping" });
      throw STOP;
    }
  };
  try {
    let fence = null, section = "", subsection = "", block = null, expected = 1;
    for (const [index, raw] of text.split(/\r?\n/).entries()) {
      const line = index + 1;
      if (fence !== null) { if (isClosingFence(raw, fence)) fence = null; continue; }
      fence = parseOpeningFence(raw);
      if (fence !== null) continue;
      if (/^#/.test(raw) || CHECKBOX.test(raw)) block = null;
      if (SECTION_BOUNDARY_HEADING_PATTERN.test(raw)) { section = raw.trim(); subsection = ""; }
      if (/^###[ \t]+/.test(raw)) subsection = raw.trim();
      const entry = { text: raw, line, section, subsection };
      visible.push(entry);
      if (raw.includes("<" + "fill")) error("R10", line, "unfilled skeleton placeholder");
      if (CHECKBOX.test(raw) && TODO_HEADING_PATTERN.test(section)) {
        const match = raw.match(STRUCTURED_CHECKBOX_PATTERN)?.[2]?.match(TODO_TASK_LABEL_PATTERN);
        const id = Number(match?.[1]);
        if (!match || !Number.isSafeInteger(id)) {
          error("R3", line, "todo must use a canonical plain integer label"); continue;
        }
        if (id !== expected || todos.has(id)) error("R3", line, `expected unique ascending todo ${expected}, got ${id}`);
        expected++;
        block = { id, line, title: match[2], lines: [], wave: null, depends: new Set(), blocks: new Set() };
        todos.set(id, block);
      } else if (CHECKBOX.test(raw) && FINAL_VERIFICATION_HEADING_PATTERN.test(section)) {
        const match = raw.match(STRUCTURED_CHECKBOX_PATTERN)?.[2]?.match(FINAL_WAVE_TASK_LABEL_PATTERN);
        if (!match) error("R4", line, "invalid final verification label");
        else finals.add(match[1].toUpperCase());
      } else if (block) block.lines.push(entry);
    }
    const first = visible.find(({ text: row }) => row.startsWith("## "));
    if (first?.text !== PLAN_SECTION_HEADERS[0]) error("R1", first?.line ?? 1, "first level-two heading must be TL;DR (For humans)");
    let previous = 0;
    for (const header of PLAN_SECTION_HEADERS) {
      const found = visible.filter(({ text: row }) => row.trim() === header);
      if (found.length !== 1 || found[0].line <= previous) error("R2", found[0]?.line ?? 1, `expected exactly one ordered ${header}`);
      if (found.length) previous = found[0].line;
    }
    if (!todos.size) error("R3", 1, "at least one todo required");
    for (const id of ["F1", "F2", "F3", "F4"]) if (!finals.has(id)) error("R4", 1, `missing ${id}`);
    const ids = (source, line) => {
      const result = new Set();
      for (const token of source.split(",").map((part) => part.trim())) {
        if (/^(?:-|—|none|n\/a|F\d+)?$/i.test(token)) continue;
        const range = token.match(/^(\d+)(?:-(\d+))?$/);
        if (!range) { error("R6", line, `unparseable id: ${token}`); continue; }
        const start = Number(range[1]), end = Number(range[2] ?? range[1]);
        if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || end < start) { error("R6", line, `unparseable id: ${token}`); continue; }
        if (end - start >= todos.size && end !== start) { error("R6", line, `unknown todo id in range ${token}`); continue; }
        for (let id = start; id <= end; id++) {
          if (!todos.has(id)) error("R6", line, `unknown todo id ${id}`);
          result.add(id);
        }
      }
      return result;
    };
    for (const todo of todos.values()) {
      const categories = todo.lines.filter(({ text: row }) => field("Recommended task executor category").test(row));
      if (categories.length !== 1) error("R5", todo.line, "exactly one Recommended task executor category field required");
      for (const entry of categories) {
        const category = value(entry.text, "Recommended task executor category").match(/^[a-z][a-z-]*(?=[`\s]|$)/)?.[0];
        if (!CATEGORIES.has(category)) error("R5", entry.line, `invalid category: ${category ?? value(entry.text, "Recommended task executor category")}`);
      }
      const parallel = todo.lines.filter(({ text: row }) => field("Parallelization").test(row));
      if (parallel.length !== 1) error("R5", todo.line, "exactly one Parallelization field required");
      for (const entry of parallel) {
        const wave = entry.text.match(/Wave\s+(\d+)/), depends = entry.text.match(/Blocked by:\s*([^|]*)/), blocks = entry.text.match(/\bBlocks:\s*([^|]*)/);
        if (!wave || !depends || !blocks || !/^\s*(?:[-*]\s+)?[*`]*Parallelization:/.test(entry.text)) error("R5", entry.line, "Parallelization requires Wave, Blocked by: and Blocks:");
        todo.wave = wave ? Number(wave[1]) : null;
        todo.depends = depends ? ids(depends[1], entry.line) : new Set();
        todo.blocks = blocks ? ids(blocks[1], entry.line) : new Set();
      }
      if (!todo.lines.some(({ text: row }) => /^\s*(?:[-*]\s+)?Commit:\s*[YN]\b/.test(row))) error("R5", todo.line, "Commit must start with Y or N");
      for (const label of ["References", "Acceptance criteria", "QA scenarios"]) if (!todo.lines.some(({ text: row }) => field(label).test(row))) error("R5", todo.line, `missing ${label} field`);
    }
    const execution = visible.filter((entry) => entry.section === "## Execution strategy");
    const matrix = execution.filter((entry) => entry.subsection === "### Dependency matrix");
    const matrixHeader = "| Todo | Depends on | Blocks | Can parallelize with |";
    if (!matrix.some(({ text: row }) => row.trim() === matrixHeader)) error("R7", 1, "missing Dependency matrix and canonical header");
    const rows = new Map();
    for (const entry of matrix.filter(({ text: row }) => row.trim().startsWith("|"))) {
      const cells = entry.text.trim().split("|").slice(1, -1).map((cell) => cell.trim());
      if (entry.text.trim() === matrixHeader || cells.every((cell) => /^:?-+:?$/.test(cell))) continue;
      const rowIds = ids(cells[0] ?? "", entry.line);
      if (cells.length !== 4 || rowIds.size !== 1 || !/^\d+$/.test(cells[0])) { error("R7", entry.line, "matrix row must name one todo and four cells"); continue; }
      const id = [...rowIds][0];
      if (rows.has(id)) error("R7", entry.line, `duplicate matrix row ${id}`);
      rows.set(id, { depends: ids(cells[1], entry.line), blocks: ids(cells[2], entry.line) });
      ids(cells[3], entry.line);
    }
    for (const todo of todos.values()) {
      const row = rows.get(todo.id);
      if (!row || !equalSets(row.depends, todo.depends) || !equalSets(row.blocks, todo.blocks)) error("R7", todo.line, `matrix dependency sets differ or row missing for todo ${todo.id}`);
      for (const dependency of todo.depends) {
        const parent = todos.get(dependency);
        if (parent && !parent.blocks.has(todo.id)) error("R7", todo.line, `dependency ${dependency} must list ${todo.id} in Blocks`);
        if (parent && !(todo.wave > parent.wave)) error("R8", todo.line, `todo ${todo.id} wave must follow dependency ${dependency}`);
      }
      for (const blocked of todo.blocks) {
        const child = todos.get(blocked);
        if (child && !child.depends.has(todo.id)) error("R7", todo.line, `todo ${blocked} must list ${todo.id} in Blocked by`);
      }
    }
    // R8 also catches cycles; this names the path.
    const visited = new Set(), active = [];
    const visit = (id) => {
      if (active.includes(id)) { error("R7", todos.get(id).line, `dependency cycle: ${[...active.slice(active.indexOf(id)), id].join(" -> ")}`); return; }
      if (visited.has(id) || !todos.has(id)) return;
      active.push(id);
      for (const dependency of todos.get(id).depends) visit(dependency);
      active.pop(); visited.add(id);
    };
    for (const id of todos.keys()) visit(id);
    if (!execution.some(({ text: row }) => row.trim() === "### Parallel execution waves")) error("R8", 1, "missing Parallel execution waves");
    const content = (header) => visible.filter((entry) => entry.section === header && entry.text.trim() !== header);
    const commitText = content("## Commit strategy").map((entry) => entry.text).join("\n").replace(/<!--[\s\S]*?(?:-->|$)/g, "");
    if (!commitText.trim()) error("R9", 1, "Commit strategy must contain non-comment content");
    if (!content(PLAN_SECTION_HEADERS[0]).some(({ text: row }) => /^\*\*Effort:\*\*\s*(Quick|Short|Medium|Large|XL)\s*$/.test(row))) error("R11", 1, "TL;DR requires a valid Effort band");
    if (!content("## Success criteria").some(({ text: row }) => row.startsWith("| IS-"))) error("R12", 1, "Success criteria requires an IS table row");
  } catch (error) {
    if (error !== STOP) throw error;
  }
  return { errors, todos };
}

// Injectable filesystem seam makes the stale-read failure deterministic in tests.
export function readPlan(planPath, io = fs) {
  const path = relative(process.cwd(), resolve(planPath)).split(sep).join("/");
  if (!/^\.omo\/plans\/[a-z0-9][a-z0-9-]{0,79}\.md$/.test(path)) throw new Error("plan path must be .omo/plans/<slug>.md");
  for (const directory of [".omo", ".omo/plans"]) if (!io.lstatSync(directory).isDirectory()) throw new Error(`${directory} must be a real directory (not a symlink or file)`);
  const before = io.lstatSync(path);
  if (before.size > 1_048_576) throw new Error("plan exceeds 1 MiB");
  if (!before.isFile()) throw new Error("plan must be a regular file, not a symlink");
  const bytes = io.readFileSync(path);
  const after = io.lstatSync(path);
  if (!after.isFile() || ["ino", "size", "mtimeMs"].some((key) => before[key] !== after[key])) throw new Error(`${path} changed during read; re-run when no other process is writing it`);
  return { path, bytes };
}

export function main(args, io = fs) {
  const paths = args.filter((arg) => !arg.startsWith("--"));
  if (paths.length !== 1 || args.some((arg) => arg.startsWith("-") && !["--digest", "--json"].includes(arg))) {
    console.error("Usage: node check-plan.mjs <plan-path> [--digest] [--json]"); return 64;
  }
  let plan;
  try { plan = readPlan(paths[0], io); }
  catch (error) { if (!(error instanceof Error)) throw error; console.error(`INCONCLUSIVE: ${error.message}`); return 2; }
  const { errors, todos } = checkPlanText(plan.bytes.toString("utf8"));
  const ok = errors.length === 0;
  const sha256 = ok && args.includes("--digest") ? createHash("sha256").update(plan.bytes).digest("hex") : null;
  if (args.includes("--json")) console.log(JSON.stringify({ ok, errors, todos: todos.size, sha256 }));
  else {
    if (ok) console.log(`OK ${todos.size} todos, F1-F4 present`);
    else for (const error of errors) console.log(`ERROR ${error.rule} line ${error.line}: ${error.message}`);
    if (sha256) console.log(`sha256 ${sha256}  ${plan.path}`);
  }
  return ok ? 0 : 1;
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) process.exitCode = main(process.argv.slice(2));
