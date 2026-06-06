# Build AI Agents: The GitHub Candidate Scout Workshop

A **7-hour, hands-on workshop** that takes developers who are comfortable with TypeScript/Node but **new to LLMs** from "what is an agent?" to a working **multi-agent system**. Every example and lab builds the same through-line project: a **GitHub Candidate Scout** — a team of AI agents that scouts GitHub for engineering candidates, gives them tools (hand-written REST tools and the **GitHub MCP server**), routes work between specialists, and runs searches in parallel.

We use the **OpenAI Agents SDK for TypeScript** (`@openai/agents`) pointed at **OpenRouter** so the same code runs against any model. The default model is **`deepseek/deepseek-v4-flash`** — small, fast, and cheap — and you can swap it with one environment variable. By the end, attendees have built and run agents, tools, an MCP connection, handoffs, an agent-as-a-tool, and a parallel scatter-gather pipeline.

> **Jargon, defined once:** An **LLM** is a text-prediction model. An **agent** is an LLM in a loop that can decide to call **tools** (functions you give it) until it has an answer. **MCP** (Model Context Protocol) is a standard way to plug a ready-made server full of tools (like GitHub) into any agent. A **handoff** lets one agent pass the conversation to a more specialized agent.

---

## Schedule

| Time          | Block                | Deck / Lab                              | What happens                                                                            |
| ------------- | -------------------- | --------------------------------------- | --------------------------------------------------------------------------------------- |
| 10:00 – 11:00 | **Lecture 1**        | `slides/lecture-1-agents-tools.md`      | Foundations: LLMs, agents, the run loop, custom tools, memory.                          |
| 11:00 – 13:00 | **Lab 1**            | `labs/lab-1-agents-tools.md`            | Build the warm-up agent, add tools, wire up `MemorySession`. (Examples 01–03)           |
| 13:00 – 14:00 | _Lunch_              | —                                       | Refuel.                                                                                 |
| 14:00 – 15:00 | **Lecture 2**        | `slides/lecture-2-mcp-orchestration.md` | MCP servers + multi-agent orchestration (handoffs, agent-as-tool, parallel).            |
| 15:00 – 17:00 | **Lab 2 + Capstone** | `labs/lab-2-mcp-orchestration.md`       | Connect GitHub MCP, build handoffs, ship the Candidate Scout capstone. (Examples 04–07) |

---

## Prerequisites (attendees)

Have these ready **before** you arrive:

1. **Node 20+** — check with `node --version`. The examples use native `fetch`, ESM, top-level `await`, and `--env-file`, all of which need Node 20 or newer.
2. **An OpenRouter API key** — free to create at <https://openrouter.ai/keys>. A few dollars of credit is plenty for the whole day.
3. **A GitHub Personal Access Token (PAT)** — needed for the **afternoon** (MCP + REST). For a **classic** token you can leave all scopes unchecked — any valid token can read public data (the explicit `public_repo` scope is optional). Create one at <https://github.com/settings/tokens>.
4. **git** and a terminal you are comfortable in.
5. **For viewing the slides as designed:** a terminal that renders inline images — **iTerm2**, **kitty**, or **wezterm**. If you are on plain Terminal.app or anything that can't show images, that's fine — the facilitator can **export the decks to PDF** (see [Presenting the decks](#presenting-the-decks)).

---

## Setup

Pull the workshop repo, then run the setup commands. Total time: ~3 minutes.

```bash
# 1. Clone the workshop repo and enter it
git clone https://github.com/ezzabuzaid/agent-workshop.git
cd agent-workshop

# Already cloned it? Pull the latest instead:
# git pull --ff-only

# 2. Install dependencies
npm install

# 3. Create your local env file from the template
cp .env.example .env

# 4. Open .env and REPLACE the placeholder values with your real keys
#    (overwrite the sk-or-... / ghp_... placeholders in place — don't add new lines)
#    OPENROUTER_API_KEY=sk-or-...        (required, morning + afternoon)
#    OPENROUTER_MODEL=deepseek/deepseek-v4-flash (optional, this is the default)
#    GITHUB_TOKEN=ghp_...                (required for the afternoon MCP labs)

# 5. Smoke-test that your key and model work
npm start
```

**You should see** something like:

```text
> model: deepseek/deepseek-v4-flash
> prompt: What's the weather in Cairo?

--- final output ---
It is 25°C and sunny in Cairo.
```

The exact temperature and wording will differ — any final-output line about Cairo's weather means your OpenRouter key, model, and toolchain all work, and you're ready. If not, jump to [Troubleshooting](#troubleshooting).

> `.env` is git-ignored, so your keys never get committed.

---

## Repository map

```text
agent-workshop/
├── README.md                  ← you are here (facilitator run-of-show + attendee setup)
├── .env.example               ← template for keys; copy to .env
├── package.json               ← npm scripts: start, start:session, ex:01..ex:07, typecheck
├── tsconfig.json              ← strict ESM TS config (typecheck only, noEmit)
│
├── openrouter-agent.ts        ← Lab 1 warm-up: a self-contained weather-tool agent  (npm start)
├── session-memory.ts          ← Lab 1 warm-up: MemorySession over 3 turns  (npm run start:session)
│
├── examples/                  ← the through-line, one concept per file
│   ├── setup.ts               ← shared OpenRouter provider + exported `model` constant
│   ├── 01-hello-agent.ts      ← bare agent (Recruiter), no tools          (ex:01)
│   ├── 02-custom-tool.ts      ← one hand-written GitHub REST tool          (ex:02)
│   ├── 03-multi-tool-agent.ts ← two tools + MemorySession over 3 turns     (ex:03)
│   ├── 04-mcp-github.ts       ← GitHub MCP server over stdio               (ex:04)
│   ├── 05-handoff-triage.ts   ← Coordinator → Sourcing / Screening handoffs (ex:05)
│   ├── 06-capstone-candidate-scout.ts ← MCP + handoffs + agent-as-tool     (ex:06)
│   ├── 07-parallel-scout.ts   ← parallel fan-out (Promise.all) + ranker    (ex:07)
│   ├── 08-web-search-tool.ts  ← hosted web search tool via webSearchTool    (ex:08)
│   └── 09-files-tools-agent.ts ← custom read/list files tools                (ex:09)
│
├── slides/
│   ├── config.yaml            ← presenterm config (catppuccin-macchiato, mermaid scale 2)
│   ├── lecture-1-agents-tools.md       ← Deck 1 (foundations + agents + tools)
│   └── lecture-2-mcp-orchestration.md  ← Deck 2 (MCP + multi-agent orchestration)
│
└── labs/
    ├── lab-1-agents-tools.md           ← Lab 1 guide (examples 01–03)
    └── lab-2-mcp-orchestration.md      ← Lab 2 + capstone guide (examples 04–07)
```

---

## Running the examples

Every example is a standalone TypeScript file run with **tsx** (no build step). The canonical command is:

```bash
node --env-file=.env --import tsx examples/01-hello-agent.ts
```

That loads `.env`, registers `tsx` so Node can run `.ts` directly, and runs the file. The same thing is wrapped in **npm scripts** so you don't have to remember the flags:

```bash
npm run ex:01   # 01-hello-agent.ts          bare agent
npm run ex:02   # 02-custom-tool.ts          one GitHub REST tool
npm run ex:03   # 03-multi-tool-agent.ts     two tools + MemorySession
npm run ex:04   # 04-mcp-github.ts           GitHub MCP over stdio   (needs GITHUB_TOKEN)
npm run ex:05   # 05-handoff-triage.ts       coordinator + handoffs
npm run ex:06   # 06-capstone-candidate-scout.ts  MCP + handoffs + agent-as-tool (needs GITHUB_TOKEN)
npm run ex:07   # 07-parallel-scout.ts       parallel fan-out + ranker
npm run ex:08   # 08-web-search-tool.ts      hosted web search tool
npm run ex:09   # 09-files-tools-agent.ts    custom read/list files tools

npm start          # openrouter-agent.ts  warm-up weather agent
npm run start:session  # session-memory.ts  warm-up memory demo
npm run typecheck      # tsc --noEmit across all files
```

Most examples take a **prompt from the command line** and fall back to a sensible default. With an npm script, pass args after `--`:

```bash
npm run ex:02 -- 'What can you tell me about the GitHub user "torvalds"?'
npm run ex:07 -- gaearon sindresorhus tannerlinsley   # screen these logins in parallel
```

### What each step should print

**`npm run ex:01`** — a bare agent, no tools:

```text
This candidate shows strong senior signals: 8 years of TypeScript plus a
widely-used open-source library points to deep platform expertise. Likely a
solid fit for a senior platform role, pending a culture and systems-design check.
```

**`npm run ex:02`** — the agent calls your hand-written `get_github_profile` tool, then summarizes:

```text
gaearon (Dan Abramov) is a high-signal senior engineer: thousands of followers
and many public repos, with a background tied to the React ecosystem. Strong fit
for senior frontend / platform roles.
```

**`npm run ex:03`** — two tools + `MemorySession`; the agent remembers the shortlist across 3 turns:

```text
> Find 3 Rust developers with a strong following.
  ...(three logins with GitHub URLs)...

> Look at the top one's repositories.
  ...(top 5 repos by stars)...

> Add them to my shortlist and tell me who we have so far.
  ...(echoes back the running shortlist it remembered)...
```

**`npm run ex:04`** — the GitHub **MCP** server starts over stdio and exposes its tools:

```text
> github MCP exposed 40+ tools, e.g. search_repositories, get_file_contents, ...

--- result ---
...(two named contributors on popular TypeScript "ai agents" repos)...
```

**`npm run ex:05`** — the coordinator **hands off** to a specialist; note which agent answered:

```text
handled by: Screening Specialist

Dana: hire — built a distributed cache in Go (strong systems signal), ...
```

**`npm run ex:06`** — the capstone: MCP + handoff + an agent used **as a tool** to write the brief:

```text
handled by: Screening Specialist

Name: gaearon
Signal: ...
Risk: ...
Suggested message: ...
```

**`npm run ex:07`** — **scatter-gather**: screen N candidates in parallel, then rank them:

```text
> scatter: screening 3 candidates in parallel...

--- gathered verdicts ---
gaearon: hire - ...
sindresorhus: hire - ...
tannerlinsley: maybe - ...

--- ranked shortlist ---
1. ... 2. ... 3. ...
```

> Outputs are LLM-generated, so exact wording will vary run to run. What matters is the **shape**: which tools fired, which agent handled it, and whether memory/parallelism behaved.

---

## Presenting the decks

The decks are built for **[presenterm](https://github.com/mfontanini/presenterm)**, a terminal slideshow tool. Install it first (`brew install presenterm`, `cargo install presenterm`, or see its README).

Present a deck with the shared config:

```bash
presenterm -c slides/config.yaml -p slides/lecture-1-agents-tools.md
presenterm -c slides/config.yaml -p slides/lecture-2-mcp-orchestration.md
```

`-p` is presentation mode; `-c slides/config.yaml` applies the **catppuccin-macchiato** theme, the `<!-- end_slide -->` shorthand, and mermaid rendering at scale 2.

**Two things to set up for the visuals:**

1. **Mermaid diagrams** need the Mermaid CLI (`mmdc`) on your `PATH`:
   ```bash
   npm install -g @mermaid-js/mermaid-cli
   ```
   presenterm renders the `mermaid +render` code blocks into images at present time.
2. **Inline images** use your terminal's image protocol (iTerm2 / kitty / wezterm). In a terminal without image support, diagrams won't show inline.

**PDF fallback** (no special terminal required) — export each deck once and present the PDF:

```bash
presenterm --export-pdf -c slides/config.yaml slides/lecture-1-agents-tools.md
presenterm --export-pdf -c slides/config.yaml slides/lecture-2-mcp-orchestration.md
```

PDF export needs **weasyprint** installed (`pip install weasyprint`). The PDF bakes in the rendered mermaid diagrams, so it's the most portable way to share or project the slides.

---

## Facilitator run-of-show

Each block lists its **goal**, the **deck/lab** to drive, **talking points**, and **time checks**. Demo by actually running the matching `npm run ex:NN` live — seeing real tool calls land is the whole point.

### 10:00 – 11:00 · Lecture 1 — Foundations, Agents, Tools

- **Goal:** Demystify LLMs and agents; by the end everyone can read `01`–`03` and predict what they print.
- **Drive:** `slides/lecture-1-agents-tools.md`.
- **Talking points:**
  - LLM vs. agent: the agent is the model **in a loop** that can call tools and decide when it's done.
  - The 3-line shape of every example: `new Agent({...})` → `run(agent, prompt)` → `result.finalOutput`. (Show `01-hello-agent.ts`.)
  - A **tool** is `tool({ name, description, parameters: z.object({...}), execute })` returning a **string**. The model picks tools by their name + description, so write those for the model to read. (Show `get_github_profile` in `02-custom-tool.ts`.)
  - Why OpenRouter: one base URL, swap models with `OPENROUTER_MODEL`. The whole provider setup lives in `examples/setup.ts`.
  - **Memory:** agents are stateless per `run`; `MemorySession` carries history across turns. (`03-multi-tool-agent.ts` keeps a shortlist alive over 3 turns.)
- **Time checks:** Concepts + `01` demo by **10:20**. Tools + `02` by **10:40**. Memory + `03` by **10:55**. Leave 5 min to set up Lab 1.

### 11:00 – 13:00 · Lab 1 — Agents and Tools

- **Goal:** Everyone runs the warm-ups, then builds/extends a tool-using agent with memory.
- **Drive:** `labs/lab-1-agents-tools.md`. Examples `01`–`03` and the warm-ups (`npm start`, `npm run start:session`).
- **Talking points / coaching:**
  - Confirm `npm start` works for **everyone** before going further — this is the moment to fix env/key issues.
  - Encourage passing custom prompts: `npm run ex:02 -- '...'`.
  - Stretch: add a third tool to `03`, or change instructions and observe behavior shifts.
- **Time checks:** Warm-ups green for the whole room by **11:30**. Core (`01`–`03`) by **12:30**. Last 30 min for stretch goals + questions.

### 13:00 – 14:00 · Lunch

### 14:00 – 15:00 · Lecture 2 — MCP + Multi-agent Orchestration

- **Goal:** Move from one agent to a coordinated team, and from hand-written tools to a real MCP server.
- **Drive:** `slides/lecture-2-mcp-orchestration.md`.
- **Talking points:**
  - **MCP:** a server exposes a bundle of tools; you `connect()`, attach via `mcpServers: [server]`, `listTools()`, and `close()`. (Show `04-mcp-github.ts` — note the GitHub server reads `GITHUB_PERSONAL_ACCESS_TOKEN`, which we pass from `GITHUB_TOKEN`.)
  - **Handoffs:** a coordinator with `handoffs: [a, b]`; each specialist has a `handoffDescription` the router reads. After `run`, `result.lastAgent` tells you who answered. (Show `05-handoff-triage.ts`.)
  - **Agent-as-tool:** wrap an agent with `agent.asTool({ toolName, toolDescription })` and hand it to another agent like any tool. (Show the Report Writer in `06`.)
  - **Parallel fan-out:** no special API — `Promise.all` over `run()`, then feed the gathered outputs to a ranker. (Show `07-parallel-scout.ts`.)
- **Time checks:** MCP + `04` by **14:20**. Handoffs + `05` by **14:40**. Agent-as-tool + parallel by **14:55**.

### 15:00 – 17:00 · Lab 2 + Capstone

- **Goal:** Each attendee connects the GitHub MCP server and assembles the full multi-agent Candidate Scout.
- **Drive:** `labs/lab-2-mcp-orchestration.md`. Examples `04`–`07`, capstone is `06`.
- **Talking points / coaching:**
  - First milestone: get `npm run ex:04` to print the MCP tool list. If `npx` is slow on first run, that's the server package downloading — be patient.
  - Build up: `05` (handoffs) → `06` (the capstone, MCP + handoff + agent-as-tool) → `07` (parallel).
  - Stretch: add a new specialist agent, give `07` more logins, or swap in a different MCP server.
- **Time checks:** MCP connected for the room by **15:30**. Capstone (`06`) running by **16:30**. Final 30 min: parallel/`07`, stretch goals, wrap-up.

---

## Model and cost note

The default model **`deepseek/deepseek-v4-flash`** is a fast model served through OpenRouter — a full day of these examples is typically low cost. It's plenty for tool-calling, handoffs, and MCP.

To try a different model, change **one line** in `.env`:

```bash
OPENROUTER_MODEL=deepseek/deepseek-v4-pro # higher quality, higher cost
# OPENROUTER_MODEL=anthropic/claude-3.5-sonnet   # stronger reasoning, higher cost
```

The model slug flows from `OPENROUTER_MODEL` → `examples/setup.ts` (`process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash'`) → every agent's `model` option, so no code changes are needed. Browse slugs at <https://openrouter.ai/models>.

---

## Troubleshooting

| Symptom                                                    | Likely cause                                                       | Fix                                                                                                  |
| ---------------------------------------------------------- | ------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `Missing OPENROUTER_API_KEY. Copy .env.example -> .env...` | No `.env`, or the key line is empty.                               | `cp .env.example .env` and paste your key from <https://openrouter.ai/keys>.                         |
| `401` / auth error from OpenRouter                         | Invalid or expired API key.                                        | Regenerate the key; ensure no quotes/spaces around it in `.env`.                                     |
| `402` / insufficient credits                               | OpenRouter account has no credit.                                  | Add a few dollars of credit at <https://openrouter.ai/credits>.                                      |
| `This example needs GITHUB_TOKEN ...` (ex:04 / ex:06)      | `GITHUB_TOKEN` not set in `.env`.                                  | Create a PAT at <https://github.com/settings/tokens> and add `GITHUB_TOKEN=ghp_...`.                 |
| ex:04 hangs for a while on first run                       | `npx` is downloading the GitHub MCP server package.                | Wait it out once; subsequent runs are fast. Or pre-set `GITHUB_MCP_CMD`/`GITHUB_MCP_ARGS` in `.env`. |
| MCP server fails to start / `command not found`            | `npx` (Node) not on `PATH`, or a custom `GITHUB_MCP_CMD` is wrong. | Confirm `node`/`npx` work; check the `GITHUB_MCP_CMD`/`GITHUB_MCP_ARGS` lines in `.env`.             |
| GitHub `403` / rate-limit in ex:02 / ex:03 / ex:07         | Hitting unauthenticated REST limits.                               | Set `GITHUB_TOKEN` in `.env` — the REST tools use it to raise the rate limit.                        |
| `Unknown file extension ".ts"` / ESM errors                | Ran the file with plain `node` (no `tsx`).                         | Use the `--import tsx` form or the `npm run ex:NN` scripts.                                          |
| `node: --env-file is not allowed` / flag unknown           | Node older than 20.                                                | Upgrade to Node 20+ (`node --version`).                                                              |
| Slides show no images / mermaid blocks blank               | Terminal has no image protocol, or `mmdc` not installed.           | Use iTerm2/kitty/wezterm + `npm i -g @mermaid-js/mermaid-cli`, or export to PDF.                     |
| `presenterm --export-pdf` errors                           | `weasyprint` not installed.                                        | `pip install weasyprint`, then re-run the export.                                                    |

---

## Stretch goals

- **Add a tool** to `03-multi-tool-agent.ts` (e.g. fetch a user's pinned repos) and watch the agent pick it.
- **Add a third specialist** to `05-handoff-triage.ts` (e.g. an "Offer" agent) and adjust the coordinator's routing instructions.
- **Feed more logins** to the parallel scout: `npm run ex:07 -- login1 login2 login3 login4`.
- **Swap the model** via `OPENROUTER_MODEL` and compare tool-calling quality and cost.
- **Try another MCP server** in place of (or alongside) GitHub and inspect its `listTools()` output.
