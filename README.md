# agent-plugins

A Claude Code plugin marketplace. One plugin so far:

| Plugin | What it is |
|---|---|
| [`omo-planner`](plugins/omo-planner/) | A planning-only port of [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent)'s Prometheus/`ulw-plan` workflow. It explores first, waits for your approval, and writes OMO-compatible `.omo/plans/<slug>.md` plans that you execute with `/ulw-execute` in OpenCode. See [`plugins/omo-planner/README.md`](plugins/omo-planner/README.md) for usage. |

## Install

```
claude plugin marketplace add matt-FFFFFF/agent-plugins
claude plugin install omo-planner@matt-FFFFFF
```

`claude plugin marketplace add` also accepts a full URL (`https://github.com/matt-FFFFFF/agent-plugins`) or a local path if you've cloned it, same install flow either way. To update after this repo changes: `claude plugin update omo-planner`.

## Migrating from omo

The `omo` plugin was removed. If you installed it, run `claude plugin uninstall omo@matt-FFFFFF`. Its planning workflow lives on in `omo-planner`. Its execution agents were dropped, so execute plans with oh-my-openagent in OpenCode.

## Adding another plugin

Drop a new plugin directory under `plugins/`, add an entry to `.claude-plugin/marketplace.json` pointing at it, and give it its own `README.md` (plus a `LICENSE.md`/`NOTICE.md` if it's derived from somewhere, the way `omo-planner` is).
