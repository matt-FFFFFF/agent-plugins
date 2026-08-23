# skills/ultimate-browsing — AGENTS.md

## OVERVIEW
A 3-tier router for blocked/hard-to-reach web access: Tier 1 `insane-search` (headless extraction + WAF bypass) → Tier 1.5 `agent-reach` (platform-native APIs, esp. Chinese platforms) → Tier 2 Chrome stealth (CloakBrowser + agent-browser). Parent: [`../../AGENTS.md`](../../AGENTS.md). **`engine/` has its own much deeper `AGENTS.md`** — read that before touching `engine/**`; this file does not repeat it.

## STRUCTURE
```
SKILL.md                    # PHASE 0 route-first decision tree — read this before anything else
ATTRIBUTION.md               # provenance for all 4 parts below — skill root, not engine/
engine/                      # 17-module vendored Python fetch chain — SEE engine/AGENTS.md, don't re-derive
references/insane-search/    # Tier-1 docs, mostly Korean, R1-R7 harness rules + no-site-name rule
references/agent-reach/      # Tier-1.5 docs, mostly Chinese, routing table + zero-config CLI commands
scripts/                     # Tier-2 cookie extraction (project-original, see below)
scripts/tests/               # unittest, not pytest
```

## WHERE TO LOOK
| Task | Location |
|------|----------|
| Which tier a request routes to | `SKILL.md` `## PHASE 0 — ROUTE FIRST (MANDATORY)` — an explicit ASCII decision tree |
| Fetch a blocked/WAF-protected URL | `engine/AGENTS.md` — Tier 1, `python3 -m engine "<URL>"` |
| Chinese platform (xhs/douyin/weibo/bilibili/v2ex/wechat) or podcast/stock-forum content | `references/agent-reach/README.md` — Tier 1.5 |
| Click/fill-form/screenshot/persistent-login work | Tier 2 — CloakBrowser + agent-browser CDP flow |
| Full provenance for all 4 vendored/original parts | `ATTRIBUTION.md` at skill root (not inside `engine/`) |
| Cookie extraction for Tier-2 login | `scripts/{extract_cookies,cookie_crypto,cookie_domains,cookie_paths}.py` |

## CONVENTIONS
- Escalation is explicit in SKILL.md: Tier 1 → Tier 1.5 when the target is a Chinese/social platform with a native reader; Tier 1/1.5 → Tier 2 when results are empty/partial or the task needs JS interaction, a screenshot, persistent login, or media playback.
- **`scripts/` (top-level, cookie extraction) requires Python 3.10+** — uses `match` statements, `assert_never`, PEP 604 unions, `TypedDict`/`NotRequired`. This **fails under a default `python3` 3.9.x** with a `SyntaxError` on `match platform:` — worth checking before assuming a local run failure is a real bug.
- Cookie handling is security-conscious by design: values are decrypted via OS keyring (macOS Keychain / Linux `secretstorage` / Windows `win32crypt`) and written with 0600 perms via atomic replace, refusing symlinks; injection into a live CDP session pipes JSON over **stdin**, never argv (avoids leaking secrets in process listings). Preserve this if touching `extract_cookies.py`/`cookie_crypto.py`.
- `ATTRIBUTION.md` §2 declares `references/insane-search/**`, `references/agent-reach/**`, and the top-level `scripts/*` as **project-original** — they reference external CLIs/APIs by name but don't vendor their source, unlike `engine/`.

## ANTI-PATTERNS
- Never hardcode a site domain or brand name into `engine/**` or `waf_profiles.yaml` — enforced by `engine/bias_check.py` (`python3 engine/bias_check.py`), see `engine/AGENTS.md` for the full no-site-name rule (not repeated here).
- Don't reach for ad-hoc `WebFetch`/`curl` on a URL known to be blocked — Tier 1's R1 harness rule mandates going through `python3 -m engine` instead, which already implements the probe→validate→detect→plan→execute→fallback chain.
- Don't treat a bare HTTP 200 as success — R2: "first 200 is not success," validate content per the 4-layer validation contract documented under `references/insane-search/`.
