# agent-plugins

A Claude Code plugin marketplace. One plugin so far:

| Plugin | What it is |
|---|---|
| [`omo`](plugins/omo/) | 10 subagents + 13 skills adapted from [oh-my-openagent](https://github.com/code-yeongyu/oh-my-openagent) for standalone Claude Code use. See [`plugins/omo/README.md`](plugins/omo/README.md) for the full roster and how to use it. |

## Install

```
claude plugin marketplace add matt-FFFFFF/agent-plugins
claude plugin install omo@agent-plugins
```

`claude plugin marketplace add` also accepts a full URL (`https://github.com/matt-FFFFFF/agent-plugins`) or a local path if you've cloned it — same install flow either way. To update after this repo changes: `claude plugin update omo`.

## Adding another plugin

Drop a new plugin directory under `plugins/`, add an entry to `.claude-plugin/marketplace.json` pointing at it, and give it its own `README.md` (plus a `LICENSE.md`/`NOTICE.md` if it's derived from somewhere, the way `omo` is).
