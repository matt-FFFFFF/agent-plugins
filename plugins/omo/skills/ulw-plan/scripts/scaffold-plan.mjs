#!/usr/bin/env node
// scaffold-plan.mjs - deterministic skeleton writer for ulw-plan's Work Plan template.
//
// Ported from oh-my-openagent's packages/shared-skills/skills/ulw-plan/scripts/scaffold-plan.mjs,
// stripped down for this port: no `.omo/` state directory, no draft-file phase, no
// review-state frontmatter - this skill has no equivalent runtime/hook machinery (see
// ../../../AGENTS.md, "Don't invent an .omo/-style hidden state directory"). What's kept:
// the deterministic template plus an idempotent, symlink-safe, path-confined write.
//
// Zero external dependencies (node:fs/path/url builtins only) so it runs under both
// `node` and `bun` with no install step. If neither runtime is available, SKILL.md's
// Phase 3 step 2 documents this exact template inline as a manual fallback - PLAN_SECTION_HEADERS
// below is the source of truth; keep the SKILL.md copy in sync if you edit either.
//
// Usage:  node scripts/scaffold-plan.mjs <slug> [--output <path>] [--reset [--force]]
//   <slug>            lowercase-hyphen id, e.g. "add-dark-mode"
//   --output <path>   target file, must end in .md (default: .claude/plans/<slug>.md).
//                      Pass this only when the user asked for a specific path.
//   --reset           overwrite an existing file instead of no-op'ing
//   --force           required alongside --reset if the existing file's content differs
//                      from a fresh skeleton (protects a hand-edited, in-progress plan)
//
// RESUME-SAFE: a plain re-run on an existing plan file is a no-op success - it never
// touches an in-progress plan's checked-off todos - so resuming after a compaction or a
// dropped turn can't accidentally clobber work.

import { lstat, mkdir, writeFile, readFile, realpath } from "node:fs/promises";
import { dirname, join, relative, resolve, isAbsolute } from "node:path";
import { pathToFileURL } from "node:url";

// Headers verbatim, in this order - SKILL.md Phase 3 step 2 states this exactly.
export const PLAN_SECTION_HEADERS = [
	"## TL;DR (For humans)",
	"## Scope",
	"## Verification strategy",
	"## Execution strategy",
	"## Todos",
	"## Final verification wave",
	"## Commit strategy",
	"## Success criteria",
];

export const FINAL_VERIFICATION_ITEMS = [
	"F1. Plan compliance audit",
	"F2. Code quality review",
	"F3. Real manual QA",
	"F4. Scope fidelity",
];

const SECTION_BODIES = {
	"## TL;DR (For humans)": `<!-- Fill this LAST, after the detailed plan below is written, so it summarizes the REAL plan. -->
(What you'll get / Why this approach / What it will NOT do / Effort / Risk / Decisions I made for you)`,
	"## Todos": `<!-- Encode each item as "- [ ] N. <title>" (implementation) or "- [ ] F<n>. <title>" (final verification). Each implementation item also carries an "Agent: sisyphus|sisyphus-junior" line. -->`,
	"## Final verification wave": `> Runs in parallel after ALL todos. ALL must pass.
${FINAL_VERIFICATION_ITEMS.map((item) => `- [ ] ${item}`).join("\n")}`,
};

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,79}$/;

export function parseArgs(argv) {
	const rest = argv.slice(2);
	let slug;
	let output;
	let reset = false;
	let force = false;
	for (let i = 0; i < rest.length; i++) {
		const arg = rest[i];
		if (arg === "--reset") reset = true;
		else if (arg === "--force") force = true;
		else if (arg === "--output") {
			output = rest[++i];
			if (output === undefined) throw new Error("--output requires a value");
		} else if (arg.startsWith("--")) throw new Error(`unknown flag: ${arg}`);
		else if (slug === undefined) slug = arg;
		else throw new Error(`unexpected argument: ${arg}`);
	}
	if (!slug) throw new Error("usage: scaffold-plan.mjs <slug> [--output <path>] [--reset [--force]]");
	if (!SLUG_PATTERN.test(slug)) {
		throw new Error(`invalid slug "${slug}" - use lowercase letters, digits, and hyphens only`);
	}
	if (force && !reset) throw new Error("--force only makes sense together with --reset");
	return { slug, output: output ?? join(".claude", "plans", `${slug}.md`), reset, force };
}

// Resolve a target path and confine it under the workspace root. Unlike the upstream
// .omo/-only version this was ported from, there's no single fixed subdirectory to
// confine to - this skill writes wherever SKILL.md's Phase 3 routing decided
// (.claude/plans/<slug>.md by default, or a user-given path) - so the guard is "stay inside the
// repo, .md only, no symlink tricks" rather than one hard-coded directory.
export function resolveSafeRepoPath(cwd, relPath) {
	const resolved = resolve(cwd, relPath);
	const rel = relative(cwd, resolved);
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(`refused: path escapes the workspace root: ${relPath}`);
	}
	if (!resolved.toLowerCase().endsWith(".md")) {
		throw new Error(`refused: scaffold-plan may only write .md files: ${relPath}`);
	}
	return resolved;
}

function assertContainedPath(parent, child, message) {
	const rel = relative(parent, child);
	if (rel.startsWith("..") || isAbsolute(rel)) {
		throw new Error(message);
	}
}

async function mkdirWithoutSymlinks(dir, stopAt) {
	if (dir === stopAt) return;
	const parent = dirname(dir);
	if (parent === dir || relative(stopAt, dir).startsWith("..") || isAbsolute(relative(stopAt, dir))) {
		throw new Error(`refused: path escapes the workspace root: ${dir}`);
	}
	await mkdirWithoutSymlinks(parent, stopAt);
	const stat = await lstat(dir).catch((err) => {
		if (err && err.code === "ENOENT") return null;
		throw err;
	});
	if (stat) {
		if (stat.isSymbolicLink()) throw new Error(`refused: path component is a symlink: ${dir}`);
		if (!stat.isDirectory()) throw new Error(`refused: path component is not a directory: ${dir}`);
		return;
	}
	await mkdir(dir);
}

async function assertSafeWriteParent(cwd, target) {
	const workspaceReal = await realpath(cwd);
	const workspaceRoot = resolve(cwd);
	const parent = dirname(target);
	assertContainedPath(workspaceRoot, parent, `refused: path escapes the workspace root: ${target}`);
	await mkdirWithoutSymlinks(parent, workspaceRoot);
	const parentReal = await realpath(parent);
	assertContainedPath(workspaceReal, parentReal, `refused: path escapes the workspace root through symlinks: ${target}`);
}

async function assertSafeWriteTarget(target) {
	const stat = await lstat(target).catch((err) => {
		if (err && err.code === "ENOENT") return null;
		throw err;
	});
	if (stat?.isSymbolicLink()) throw new Error(`refused: target is a symlink: ${target}`);
}

// A file this script previously emitted, used to make a plain re-run a safe no-op
// instead of a crash or a clobber of an in-progress plan's checked-off todos.
export function isPlanArtifact(content) {
	return content.includes("## TL;DR (For humans)") && content.includes("## Final verification wave");
}

export function buildPlanSkeleton(slug) {
	const sections = PLAN_SECTION_HEADERS.map((header) => {
		const body = SECTION_BODIES[header];
		return body ? `${header}\n${body}` : header;
	}).join("\n\n");
	return `# ${slug} - Work Plan\n\n${sections}\n`;
}

// Resume-safe write: plain re-run on an existing plan artifact is a no-op success;
// --reset overwrites but refuses to discard a hand-edited file unless --force too.
export async function writeGuarded(cwd, relPath, content, { reset = false, force = false } = {}) {
	const target = resolveSafeRepoPath(cwd, relPath);
	await assertSafeWriteParent(cwd, target);
	await assertSafeWriteTarget(target);
	const existing = await readFile(target, "utf8").catch(() => null);
	if (existing && existing.trim() !== "") {
		if (!reset) {
			if (isPlanArtifact(existing)) return { relPath, status: "exists" };
			throw new Error(`refused: ${relPath} exists and is not a ulw-plan artifact (pass --reset to overwrite)`);
		}
		if (existing.trim() !== content.trim() && !force) {
			throw new Error(`refused: ${relPath} has edits that differ from a fresh skeleton; pass --reset --force to discard them`);
		}
	}
	await writeFile(target, content, "utf8");
	return { relPath, status: existing ? "reset" : "created" };
}

export async function scaffold(cwd, { slug, output, reset = false, force = false }) {
	return writeGuarded(cwd, output, buildPlanSkeleton(slug), { reset, force });
}

async function main() {
	const { slug, output, reset, force } = parseArgs(process.argv);
	const result = await scaffold(process.cwd(), { slug, output, reset, force });
	process.stdout.write(`${result.status}: ${result.relPath}\n`);
	process.stdout.write(
		result.status === "exists"
			? `skeleton already present - left untouched. APPEND todos into "## Todos"; fill "## TL;DR (For humans)" LAST.\n`
			: `next: research and record findings/decisions in conversation (this skill keeps no draft file), then APPEND task batches into "## Todos"; fill "## TL;DR (For humans)" LAST.\n`,
	);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
	await main().catch((err) => {
		process.stderr.write(`${err instanceof Error ? err.message : String(err)}\n`);
		process.exit(1);
	});
}
