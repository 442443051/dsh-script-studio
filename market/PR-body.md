## Add dsh-script-studio

Adds one entry for **dsh-script-studio** — a short-drama script production workbench.

### What it does

Four deterministic local tools (no model calls):

- `script_studio_audit` — audits a project directory: episode/scene/dialogue/action counts, per-episode dialogue volume, soft endings, static openings, scene reuse, hook-type quota, outline `risk_tag` / `diff_service` coverage, redline phrases, and an h proxy.
- `script_studio_score` — weighted score under the 2026-10-31 overseas vertical-short-drama standard (20/25/20/20/15), pass/fail verdict, self-score → external-score calibration (−3.5~5), per-dimension advice.
- `script_studio_new_project` — scaffolds 00 positioning, 01 character bible, 02 40-episode outline table, 03 first-10-episode script template, 04 QA, 05 risk file.
- `script_studio_playbook` — the v2.0-r4 workflow: 9 steps, 7 hard rules, validated technique library, project record.

### Requirements met

- `package.json` declares `dsh.bundle.patch`; `cordis.patch.yml` is at the repo root.
- Real, tested code: all four tools were exercised against a real 10-episode project (audit h=0.90, score matched an external reviewer's 84.5 exactly).
- Zero runtime dependencies; uses only Node built-ins (`fs`, `path`, `zlib`).
- `@deepseek-ai/dsh-tools` is a peer dependency (provided by the host).

### Install after merge

```sh
dsh plugin --profile <profile> add github:<owner>/dsh-script-studio
```

Or install the prebuilt tarball from the v1.0.0 release.
