import { after, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import {
	PLAN_SECTION_HEADERS,
	buildDraft,
	buildPlanSkeleton,
	parseArgs,
	resolveSafeOmoPath,
	scaffold,
} from "../scaffold-plan.mjs";

const SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "scaffold-plan.mjs");
const dirs = [];
function tmp() {
	const d = fs.mkdtempSync(path.join(os.tmpdir(), "scaffold-plan-"));
	dirs.push(d);
	return d;
}
after(() => {
	for (const d of dirs) fs.rmSync(d, { recursive: true, force: true });
});

const argv = (...a) => ["node", "scaffold-plan.mjs", ...a];

test("parseArgs accepts <slug> --clear --draft-only --review-required", () => {
	// Given / When
	const r = parseArgs(argv("demo", "--clear", "--draft-only", "--review-required"));
	// Then
	assert.deepEqual(r, {
		slug: "demo",
		intent: "clear",
		reset: false,
		force: false,
		draftOnly: true,
		reviewRequired: true,
	});
});

test("parseArgs rejects Bad_Slug, unknown flag, missing slug and extra argument", () => {
	assert.throws(() => parseArgs(argv("Bad_Slug")), /invalid slug/);
	assert.throws(() => parseArgs(argv("demo", "--x")), /unknown flag: --x/);
	assert.throws(() => parseArgs(argv()), /usage/);
	assert.throws(() => parseArgs(argv("demo", "other")), /unexpected argument/);
});

test("resolveSafeOmoPath refuses paths outside .omo/ and non-.md targets", () => {
	const t = tmp();
	assert.throws(() => resolveSafeOmoPath(t, "src/a.md"), /only write under \.omo\//);
	assert.throws(() => resolveSafeOmoPath(t, ".omo/plans/a.ts"), /only write \.md/);
	assert.throws(() => resolveSafeOmoPath(t, "../escape.md"), /escapes the workspace/);
});

test("draft-only scaffold creates the draft and not the plan", async () => {
	const t = tmp();
	const res = await scaffold(t, { slug: "demo", intent: "clear", draftOnly: true });
	assert.deepEqual(res.map((r) => r.status), ["created"]);
	assert.ok(fs.existsSync(path.join(t, ".omo/drafts/demo.md")));
	assert.ok(!fs.existsSync(path.join(t, ".omo/plans/demo.md")));
});

test("full scaffold creates both draft and plan", async () => {
	const t = tmp();
	const res = await scaffold(t, { slug: "demo", intent: "clear" });
	assert.deepEqual(res.map((r) => r.status), ["created", "created"]);
	assert.ok(fs.existsSync(path.join(t, ".omo/drafts/demo.md")));
	assert.ok(fs.existsSync(path.join(t, ".omo/plans/demo.md")));
});

test("second scaffold returns exists and leaves an appended line intact", async () => {
	const t = tmp();
	await scaffold(t, { slug: "demo", intent: "clear" });
	const plan = path.join(t, ".omo/plans/demo.md");
	fs.appendFileSync(plan, "- [ ] 1. appended todo\n");
	const res = await scaffold(t, { slug: "demo", intent: "clear" });
	assert.deepEqual(res.map((r) => r.status), ["exists", "exists"]);
	assert.ok(fs.readFileSync(plan, "utf8").endsWith("- [ ] 1. appended todo\n"));
});

test("--reset without --force on an edited plan throws; with --force it overwrites", async () => {
	const t = tmp();
	await scaffold(t, { slug: "demo", intent: "clear" });
	const plan = path.join(t, ".omo/plans/demo.md");
	fs.appendFileSync(plan, "- [ ] 1. hand edit\n");
	await assert.rejects(scaffold(t, { slug: "demo", intent: "clear", reset: true }), /--reset --force/);
	assert.ok(fs.readFileSync(plan, "utf8").includes("hand edit"));
	const res = await scaffold(t, { slug: "demo", intent: "clear", reset: true, force: true });
	assert.equal(res[1].status, "reset");
	assert.ok(!fs.readFileSync(plan, "utf8").includes("hand edit"));
});

test("existing non-artifact file is refused without --reset", async () => {
	const t = tmp();
	fs.mkdirSync(path.join(t, ".omo/drafts"), { recursive: true });
	fs.writeFileSync(path.join(t, ".omo/drafts/demo.md"), "random notes\n");
	await assert.rejects(scaffold(t, { slug: "demo", intent: "clear" }), /not an omo-planner plan artifact/);
});

test("symlinked .omo/plans dir makes scaffold throw and writes nothing outside", async () => {
	const t = tmp();
	const outside = tmp();
	fs.mkdirSync(path.join(t, ".omo"));
	fs.symlinkSync(outside, path.join(t, ".omo/plans"));
	await assert.rejects(scaffold(t, { slug: "demo", intent: "clear" }), /symlink/);
	assert.deepEqual(fs.readdirSync(outside), []);
});

test("symlinked .omo/drafts dir makes scaffold throw and writes nothing outside", async () => {
	const t = tmp();
	const outside = tmp();
	fs.mkdirSync(path.join(t, ".omo"));
	fs.symlinkSync(outside, path.join(t, ".omo/drafts"));
	await assert.rejects(scaffold(t, { slug: "demo", intent: "clear", draftOnly: true }), /symlink/);
	assert.deepEqual(fs.readdirSync(outside), []);
});

test("symlinked target file is refused and the link target is untouched", async () => {
	const t = tmp();
	const outside = path.join(tmp(), "victim.md");
	fs.writeFileSync(outside, "victim\n");
	fs.mkdirSync(path.join(t, ".omo/drafts"), { recursive: true });
	fs.symlinkSync(outside, path.join(t, ".omo/drafts/demo.md"));
	await assert.rejects(scaffold(t, { slug: "demo", intent: "clear", draftOnly: true }), /target is a symlink/);
	assert.equal(fs.readFileSync(outside, "utf8"), "victim\n");
});

test("skeleton has the 8 section headers in order and the category line", () => {
	const skeleton = buildPlanSkeleton("demo", "clear");
	const lines = skeleton.split("\n");
	const idx = PLAN_SECTION_HEADERS.map((h) => lines.indexOf(h));
	assert.ok(idx.every((i) => i >= 0), `missing header in ${idx}`);
	assert.deepEqual([...idx].sort((a, b) => a - b), idx);
	assert.equal(PLAN_SECTION_HEADERS.length, 8);
	assert.ok(skeleton.includes("  Recommended task executor category:"));
});

test("skeleton and draft carry no execution-harness text", () => {
	const forbidden = /Senpi|Codex|attemptDir|ulw-loop|omo-agent-toolkit/;
	for (const intent of ["clear", "unclear"]) {
		assert.doesNotMatch(buildPlanSkeleton("demo", intent), forbidden);
		assert.doesNotMatch(buildDraft("demo", intent), forbidden);
		assert.doesNotMatch(buildDraft("demo", intent, { reviewRequired: true }), forbidden);
	}
});

test("CLI: valid run prints created line; Bad_Slug exits 1 with invalid slug", () => {
	const t = tmp();
	const ok = spawnSync("node", [SCRIPT, "demo", "--clear", "--draft-only"], { cwd: t, encoding: "utf8" });
	assert.equal(ok.status, 0);
	assert.match(ok.stdout, /created: \.omo\/drafts\/demo\.md/);
	const bad = spawnSync("node", [SCRIPT, "Bad_Slug"], { cwd: t, encoding: "utf8" });
	assert.equal(bad.status, 1);
	assert.match(bad.stderr, /invalid slug/);
	const flag = spawnSync("node", [SCRIPT, "demo", "--x"], { cwd: t, encoding: "utf8" });
	assert.equal(flag.status, 1);
	assert.match(flag.stderr, /unknown flag/);
});
