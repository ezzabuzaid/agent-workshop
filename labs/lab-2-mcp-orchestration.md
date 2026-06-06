# Lab 2 - MCP and Multi-Agent Orchestration

**Slot:** 15:00 - 17:00 (120 min) - the afternoon hands-on block.

**Goal:** Connect the **GitHub MCP server** to your agents, then assemble the full multi-agent **Candidate Scout**: a coordinator that hands off to specialists, specialists that call live GitHub tools over MCP, and a report-writer agent exposed as a tool.

By the end you will have run four real programs (`ex:04` -> `ex:07`), understood how data flows through a multi-agent system, and extended it yourself in the capstone challenge.

---

## Jargon, defined once

- **MCP (Model Context Protocol):** an open standard for handing an agent a *set of tools* from an external server, instead of you hand-writing each tool. The GitHub MCP server gives your agent ready-made tools like "search users", "get repo", etc.
- **stdio transport:** the MCP server runs as a local child process; your program talks to it over stdin/stdout. (`MCPServerStdio`). There is also an HTTP transport (`MCPServerStreamableHttp`) - not used in this lab.
- **Handoff:** one agent passing the whole conversation to another agent. The receiving agent finishes the job. Think "transfer the call to a specialist."
- **Agent-as-tool:** wrapping an agent so another agent can *call* it like a function (and get the result back) without giving up control. Think "consultant on retainer," not a transfer.

---

## Prerequisites

This lab assumes **Node 20+** and that you completed `npm install` in Lab 1 (so `npx` and the project dependencies are present). Quick check: `node -v` should print v20 or higher.

Your `.env` must also still contain your **`OPENROUTER_API_KEY`** from Lab 1 (it is in `.env.example`). Every example imports `setup.ts`, which exits immediately with `Missing OPENROUTER_API_KEY` if that key is absent - so if you skipped Lab 1's `.env` setup, fix it now.

> **Get your token before 15:00 if you can.** The GitHub token below is the first thing every MCP step needs. If you set it up over lunch, you start Step 1 with zero setup friction.

## GitHub Personal Access Token (REQUIRED here)

Steps 1, 3 and the capstone **will not run** without a GitHub token. The MCP server authenticates to GitHub with it. Do this first.

### Create the token (5-10 min if you have never made a PAT)

1. Go to **https://github.com/settings/tokens**.
2. Easiest path: **Tokens (classic)** -> **Generate new token (classic)**.
3. Give it a name like `candidate-scout-workshop` and a short expiry (e.g. 7 days).
4. **Minimal scopes:** check only **`public_repo`** (read access to public repositories). You do **not** need `repo`, `admin`, or any write scope for this lab. A fine-grained token with read-only "Public repositories" access works too.
5. Click **Generate token** and **copy it now** - GitHub shows it only once. It looks like `ghp_xxxxxxxx...`.

### Put it in `.env`

Open the project's `.env` (copy from `.env.example` if you have not already) and set:

```bash
GITHUB_TOKEN=ghp_your_token_here
```

> The examples read `process.env.GITHUB_TOKEN` and pass it to the MCP server as the env var `GITHUB_PERSONAL_ACCESS_TOKEN` (the name the GitHub MCP server expects). You only set `GITHUB_TOKEN`; the code does the renaming for you.

### Which MCP server runs?

By **default** the examples launch the npx reference server - no extra install, npx fetches it on first run:

```
npx -y @modelcontextprotocol/server-github
```

You can swap in the official **Go/Docker** server via two optional env vars (see `.env.example`):

```bash
# Optional alternative server (only if you prefer Docker):
GITHUB_MCP_CMD=docker
GITHUB_MCP_ARGS=run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server
```

If you do nothing, you get the npx server. That is fine for the whole lab.

---

## Time budget (120 min)

| Block | Minutes |
| --- | --- |
| Token setup (do over lunch if you can) | up to 10 |
| Step 1 - MCP connect | 25 |
| Step 2 - Handoffs (core) | 20 |
| Step 3 - Full Candidate Scout | 30 |
| Capstone challenge | 25 |
| Buffer (npx downloads, 401s, rate limits) | ~15 |

Stretch A is **optional / take-home** - do it only if you are ahead. The capstone is the point of the afternoon, so guard its time.

## STEP 1 - Connect the GitHub MCP server (about 25 min)

**File:** [`examples/04-mcp-github.ts`](../examples/04-mcp-github.ts)

### Run it

```bash
npm run ex:04
```

(First run is slow: `npx` downloads the MCP server. Give it up to a minute. **Tip:** kick this off the moment you reach Step 1 so the download happens while you read the code below.)

You can also pass your own prompt:

```bash
npm run ex:04 -- "List the top Rust web frameworks and one maintainer of each"
```

### What the code does

You create a server handle, **connect**, ask it what tools it exposes, then hand those tools to an agent via `mcpServers`:

```ts
const github = new MCPServerStdio({
	name: 'github',
	command: process.env.GITHUB_MCP_CMD ?? 'npx',
	args: process.env.GITHUB_MCP_ARGS?.split(' ') ?? [
		'-y',
		'@modelcontextprotocol/server-github',
	],
	env: { GITHUB_PERSONAL_ACCESS_TOKEN: token },
	cacheToolsList: true,
});

await github.connect();
```

```ts
const scout = new Agent({
	name: 'Scout',
	instructions:
		'You are a technical sourcer. Use the GitHub tools to research candidates ' +
		'and repositories. Be concise and cite the data you used.',
	model,
	mcpServers: [github],
});
```

Three lifecycle calls matter:

- `await github.connect()` - launches the child process and opens the channel.
- `await github.listTools()` - returns the tools the server exposes (used here just to print them).
- `await github.close()` - shuts the child process down. It is in a `finally` block so it always runs, even on error.

The agent never sees `listTools()` directly - attaching `mcpServers: [github]` is what makes the tools callable during `run()`.

### CHECKPOINT - you should see

```
> github MCP exposed 26 tools, e.g. create_or_update_file, search_repositories, get_file_contents, push_files, create_issue

--- result ---
<a short, cited answer naming repos and contributors>
```

The exact tool count and names depend on the server version - **the important thing is the `> github MCP exposed N tools` line printed at all**, with `N` greater than zero, followed by a `--- result ---` block. If you see that, MCP is working.

### Troubleshoot: the server will not start

- **Hang on first run / nothing prints for ~30s:** normal - `npx` is downloading the server. Wait. If it still hangs after a minute, Ctrl-C and re-run.
- **`This example needs GITHUB_TOKEN ...` then exit:** your `.env` has no `GITHUB_TOKEN`. Go back to the prerequisite.
- **`command not found: npx` / spawn errors:** Node 20+ must be on your PATH (`node -v`, `npx -v`). Reinstall Node if missing.
- **401 / bad credentials inside tool results:** the token is wrong, expired, or lacks `public_repo`. Regenerate it.
- See the full Troubleshooting section at the bottom for more.

---

## STEP 2 - Handoffs and triage (about 20 min core)

**File:** [`examples/05-handoff-triage.ts`](../examples/05-handoff-triage.ts)

This step has **no MCP** - it is pure orchestration, so it is fast and cheap to experiment with.

### Run it

```bash
npm run ex:05
```

Try both routing paths:

```bash
# Should route to SOURCING (find new people)
npm run ex:05 -- "Find me three senior Go engineers who do open-source"

# Should route to SCREENING (evaluate a known person)
npm run ex:05 -- 'Is "Dana", who built a distributed cache in Go, a fit for senior backend?'
```

### What the code does

Two specialists each carry a one-line `handoffDescription` (the coordinator reads these to decide where to route). A coordinator lists them in `handoffs` and is told to **never answer directly**:

```ts
const sourcing = new Agent({
	name: 'Sourcing Specialist',
	handoffDescription:
		'Finds NEW candidates from criteria like role, stack, and location.',
	instructions:
		'You propose 3 candidate archetypes and where on GitHub to find them. ' +
		'Be specific and brief.',
	model,
});
```

```ts
const coordinator = new Agent({
	name: 'Hiring Coordinator',
	instructions:
		'You route recruiting requests and never answer directly. ' +
		'If the user wants to FIND people, hand off to the Sourcing Specialist. ' +
		'If they want to EVALUATE a specific person, hand off to the Screening Specialist.',
	model,
	handoffs: [sourcing, screening],
});
```

After the run, `result.lastAgent` tells you **which agent actually produced the final answer**:

```ts
const result = await run(coordinator, prompt);
console.log(`handled by: ${result.lastAgent?.name}\n`);
console.log(result.finalOutput);
```

### CHECKPOINT - you should see

For the screening prompt, the first line names the specialist that handled it:

```
handled by: Screening Specialist

<a hire / no-hire recommendation with two reasons>
```

For the sourcing prompt you should instead see `handled by: Sourcing Specialist`. If `handled by:` shows the coordinator's own name, the routing did not hand off - see "model not handing off" in Troubleshooting.

### Mini-exercise (optional, ~10 min - skip if behind): add a third specialist

Add an **Outreach Specialist** that drafts a first-contact message. Two small edits:

1. Define it next to the others, with its own `handoffDescription`:

```ts
const outreach = new Agent({
	name: 'Outreach Specialist',
	handoffDescription:
		'Drafts a short, friendly first-contact message to a specific candidate.',
	instructions:
		'You write a 3-sentence outreach message: a specific compliment, the role, ' +
		'and a low-pressure call to action.',
	model,
});
```

2. Add it to the coordinator's `handoffs` array and mention it in the coordinator's instructions (e.g. "If they want to CONTACT someone, hand off to the Outreach Specialist."):

```ts
handoffs: [sourcing, screening, outreach],
```

Re-run with a message-drafting prompt and confirm `handled by: Outreach Specialist`:

```bash
npm run ex:05 -- 'Draft a message to reach out to "gaearon" about a frontend platform role'
```

---

## STEP 3 - The full Candidate Scout (about 30 min)

**File:** [`examples/06-capstone-candidate-scout.ts`](../examples/06-capstone-candidate-scout.ts)

This is the centerpiece: it combines **everything** - MCP-backed specialists, handoffs, and one agent exposed as a tool.

### Run it

```bash
npm run ex:06
```

```bash
# Or research a specific user:
npm run ex:06 -- 'Research the GitHub user "tannerlinsley" for a senior frontend role and draft an outreach brief'
```

### Trace the flow

```
You -> Coordinator (routes, never answers)
          |
          |-- FIND people -----> Sourcing Specialist  --[GitHub MCP tools]--> GitHub
          |
          '-- EVALUATE person -> Screening Specialist --[GitHub MCP tools]--> GitHub
                                        |
                                        '-- calls write_outreach_brief (Report Writer agent-as-tool)
                                                  -> returns a 4-line brief
```

Two things to notice in the code:

**1. Specialists get the live GitHub tools via `mcpServers`** (same server handle Step 1 introduced):

```ts
const sourcing = new Agent({
	name: 'Sourcing Specialist',
	handoffDescription: 'Finds new candidates on GitHub from a role brief.',
	instructions:
		'Use the GitHub tools to find 3 plausible candidates for the role, ' +
		'with one line each on why they fit.',
	model,
	mcpServers: [github],
});
```

**2. The Screening Specialist gets a *report-writer agent* as a callable tool** via `asTool` - it does **not** hand off to it; it calls it and keeps control:

```ts
const reportWriter = new Agent({
	name: 'Report Writer',
	instructions:
		'Turn raw notes about a candidate into a tight 4-line outreach brief: ' +
		'Name, Signal, Risk, Suggested message.',
	model,
});
```

```ts
const screening = new Agent({
	name: 'Screening Specialist',
	handoffDescription: 'Researches one named candidate and writes an outreach brief.',
	instructions:
		'Use the GitHub tools to research the named candidate, then call the ' +
		'write_outreach_brief tool to produce the final brief.',
	model,
	mcpServers: [github],
	tools: [
		reportWriter.asTool({
			toolName: 'write_outreach_brief',
			toolDescription: 'Turn candidate notes into a 4-line outreach brief.',
		}),
	],
});
```

> **Handoff vs agent-as-tool - the key distinction:** the Coordinator *hands off* to a specialist (transfers the whole conversation, and `lastAgent` changes). The Screening Specialist *calls* the Report Writer as a tool (gets a result back, stays in charge). Same building blocks from Steps 1 and 2, composed.

### CHECKPOINT - you should see

```
handled by: Screening Specialist

Name: <login>
Signal: <what makes them strong, from GitHub data>
Risk: <a caveat>
Suggested message: <one-line opener>
```

The exact wording varies (it is an LLM), but the shape - routed to Screening, then a 4-line Name/Signal/Risk/Suggested-message brief - is what you want. Spend the rest of this step re-running with different users and reading the briefs critically.

---

## STRETCH A - Parallel fan-out / scatter-gather (optional / take-home, ~15 min)

**File:** [`examples/07-parallel-scout.ts`](../examples/07-parallel-scout.ts)

Do this only if you finished Step 3 with time to spare; otherwise read it after the workshop - the capstone below is the priority. So far agents ran one at a time. Here we screen **several candidates at once**, then rank the results. There is **no special parallel API** - just `Promise.all` over `run()`, then feed the gathered outputs to a ranker agent.

### Run it

```bash
npm run ex:07
```

```bash
# Or pass your own logins as args:
npm run ex:07 -- gaearon sindresorhus kentcdodds
```

### What the code does

**Scatter** - fire one `run()` per candidate concurrently:

```ts
const verdicts = await Promise.all(
	candidates.map(async (login) => {
		const r = await run(screener, `Evaluate the GitHub user "${login}".`);
		return r.finalOutput ?? `${login}: (no verdict)`;
	}),
);
```

**Gather + rank** - pass all the verdicts to a separate ranker agent:

```ts
const ranked = await run(ranker, `Rank these candidates:\n${verdicts.join('\n')}`);
console.log('\n--- ranked shortlist ---\n' + ranked.finalOutput);
```

(This example uses the hand-written `get_github_profile` tool from Lab 1, not MCP, so it runs even if your MCP server is being slow.)

### CHECKPOINT - you should see

```
> scatter: screening 3 candidates in parallel...

--- gathered verdicts ---
gaearon: hire - <one-clause reason>
sindresorhus: hire - <one-clause reason>
tannerlinsley: maybe - <one-clause reason>

--- ranked shortlist ---
1. <login> - <half-line justification>
2. <login> - <half-line justification>
3. <login> - <half-line justification>
```

---

## CAPSTONE CHALLENGE (~25 min - this is the goal, leave room for it)

Pick **one** and extend the system. Copy the example you are extending into a new file (e.g. `examples/06-capstone-candidate-scout.ts` -> work in place or duplicate it) and iterate. Goal: make a change, run it, and read the output to confirm your change took effect.

### Option 1 - Add a Scoring Specialist (recommended)

Add a third specialist to `06` that returns a **numeric 1-10 fit score** with a one-line justification, alongside the existing Sourcing and Screening specialists.

- Give it `mcpServers: [github]` so it can pull real signals (followers, repos, languages).
- Write a tight `handoffDescription` like `'Scores one candidate 1-10 for a role and explains the number.'`
- Add it to `coordinator.handoffs` and tell the coordinator when to route to it.
- Test: `npm run ex:06 -- 'Score the GitHub user "sindresorhus" for a senior open-source maintainer role'` and confirm `handled by: Scoring Specialist`.

### Option 2 - Change the role criteria

Rewrite the specialists' `instructions` to scout for a **different role** (e.g. "senior Rust systems engineer" or "developer-advocate / DevRel"). Notice how only the prompt/instructions change - the orchestration is untouched. This shows the system is reusable across roles.

### Option 3 - Coordinator hands off to the parallel screener

Wire `07`'s scatter-gather into `06`. Wrap the parallel-screening logic in a function, expose it - either as its own agent the coordinator hands off to, or via `asTool` - so that when the user provides *a list of candidates*, the coordinator triggers the parallel screen + rank instead of the single-candidate path. This is the most advanced option; reach for it if you finished the others.

For any option, a quick way to sanity-check routing is the `handled by:` line and the `result.lastAgent?.name` value.

---

## Troubleshooting

### MCP server fails to launch

- **`command not found: npx` or spawn ENOENT:** Node 20+ is not on your PATH. Check `node -v` and `npx -v`. The default `command` is `npx`; if you set `GITHUB_MCP_CMD`, make sure that binary (e.g. `docker`) is installed and running.
- **Long hang on first `ex:04` / `ex:06`:** `npx` is downloading `@modelcontextprotocol/server-github`. First run only; later runs are fast. Wait up to a minute, then Ctrl-C and retry if needed.
- **Process exits immediately with `needs GITHUB_TOKEN`:** no token in `.env`. See the prerequisite.
- **`Missing OPENROUTER_API_KEY` then exit:** your `.env` is missing the OpenRouter key. Copy it from `.env.example` and set it - it is the same key you used in Lab 1.
- **Server starts but every tool returns 401 / "Bad credentials":** token is invalid, expired, or missing `public_repo`. Regenerate at https://github.com/settings/tokens.
- **Using Docker server and it stalls:** Docker Desktop must be running; the first run pulls the image. Confirm with `docker ps`.

### GitHub rate limits

- Symptom: tool results contain `API rate limit exceeded` or HTTP 403. Authenticated requests get a far higher limit than anonymous ones - so first make sure your `GITHUB_TOKEN` is actually set and valid (an invalid token falls back to the anonymous, low limit).
- Mitigation: re-run with fewer candidates, wait a few minutes (limits reset hourly), and avoid hammering `ex:07` with long login lists.

### Model not calling the MCP tools (answers from memory instead)

- The instructions must explicitly tell the agent to **use the GitHub tools** (the examples do: "Use the GitHub tools to research..."). If you rewrite instructions, keep that nudge.
- Confirm the server is attached: the agent needs `mcpServers: [github]`. An agent with no `mcpServers` simply cannot call them.
- Smaller models sometimes guess. Re-run; if it persists, make the instruction more direct ("You MUST call a GitHub tool before answering").

### Model not handing off (coordinator answers itself)

- Symptom: `handled by:` shows the coordinator, not a specialist.
- The coordinator's instructions must say it **never answers directly** and must describe *when* to pick each specialist. The specialists' `handoffDescription` is what the coordinator routes on - make each one distinct and specific.
- If two descriptions overlap, the model gets confused. Sharpen them.

### Handoff loop (agents bouncing back and forth)

- Cause: two agents each list the *other* in `handoffs`, or a specialist hands back to the coordinator which routes it straight back.
- Fix: keep handoffs **one-directional** for this lab - the coordinator hands off *to* specialists, and specialists do **not** list the coordinator (or each other) in their own `handoffs`. Specialists finish the job. If you need a specialist to consult another agent, use `asTool` (call-and-return), not a handoff.

---

## Reference - the files behind each step

| Step | Command | File |
| --- | --- | --- |
| 1 - MCP connect | `npm run ex:04` | [`examples/04-mcp-github.ts`](../examples/04-mcp-github.ts) |
| 2 - Handoffs / triage | `npm run ex:05` | [`examples/05-handoff-triage.ts`](../examples/05-handoff-triage.ts) |
| 3 - Full Candidate Scout | `npm run ex:06` | [`examples/06-capstone-candidate-scout.ts`](../examples/06-capstone-candidate-scout.ts) |
| Stretch A - Parallel | `npm run ex:07` | [`examples/07-parallel-scout.ts`](../examples/07-parallel-scout.ts) |
| Shared provider/model | - | [`examples/setup.ts`](../examples/setup.ts) |

Every example runs the same way under the hood: `node --env-file=.env --import tsx <file>.ts`. The `npm run ex:NN` scripts just wrap that for you.
