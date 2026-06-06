# Lab 1 - Your First Agent, and Giving It Tools

**Slot:** 11:00-13:00 (120 minutes) - **Hands-on**

**Pacing (with slack for setup + debugging):** Setup/verify ~15, Step 1 ~15, Step 2 ~30, Step 3 ~30, Stretch ~15, buffer ~15. The per-step markers below are softer than they look - the **must-finish line is Step 3 running**. The Step 3 mini-exercise and the Stretch are optional; drop them if you are behind.

---

## Goal

By the end of this lab you will have run three working agents and written one of your own. You will start with a bare agent that just talks to a model, then give an agent a single **tool** (a function the model can decide to call) that reads a live GitHub profile, then build a multi-tool agent that remembers a conversation across three turns. You finish by writing a brand-new GitHub tool from scratch and wiring it in. Everything is part of the **GitHub Candidate Scout** - the system we grow across the whole workshop.

**Jargon, defined once:**
- **Agent** = a model plus instructions (a system prompt) plus an optional set of tools. You give it input; it produces output, optionally calling tools along the way.
- **Tool** = a normal function you write. You describe it to the model; the model decides *when* to call it and *with what arguments*. You run the function and hand the result back.
- **Model** = the LLM doing the reasoning. Ours is `deepseek/deepseek-v4-flash`, reached through OpenRouter.

---

## Prerequisites and setup (~15 min in-room if not done beforehand)

Do this **before 11:00 if you can** - it is the most overrun-prone part (key signup, billing/credits, token creation). If you arrive set up, this is a 2-minute check; if not, budget ~15 min. **Hard gate: everyone must see the weather output below before we start Step 1.**

You need **Node 20 or newer**. Check:

```bash
node --version
```

From the project root, install dependencies:

```bash
npm install
```

Create your `.env` from the template:

```bash
cp .env.example .env
```

Open `.env` and fill in:

| Variable | Required? | Where to get it |
| --- | --- | --- |
| `OPENROUTER_API_KEY` | **Yes** | Create a key at https://openrouter.ai/keys (starts with `sk-or-...`). |
| `OPENROUTER_MODEL` | No (defaults to `deepseek/deepseek-v4-flash`) | Any OpenRouter model slug. Leave the default. |
| `GITHUB_TOKEN` | Optional but recommended | https://github.com/settings/tokens - no scopes needed for a classic token (or read-only public access for fine-grained); this lab only reads public data, and merely being authenticated raises the rate limit. Without a token, GitHub's REST API limits you to ~60 requests/hour and will start returning `403`. With it you get ~5000/hour. |

> **If you do not have a real token, delete the `GITHUB_TOKEN=ghp_...` line from `.env` entirely.** It ships as a placeholder, and sending an *invalid* token (`Authorization: Bearer ghp_...`) makes GitHub reject you with `401` - worse than sending no token, which still works at the lower rate limit.

> Every command in this lab runs files the same way: `node --env-file=.env --import tsx <file>.ts`. The `npm run ...` scripts just wrap that. `--env-file=.env` loads your keys; `--import tsx` lets Node run TypeScript directly.

### Verify-setup checkpoint

Run the warm-up scaffold (a tiny weather agent - no GitHub needed):

```bash
npm start
```

**You should see** something like:

```
> model: deepseek/deepseek-v4-flash
> prompt: What's the weather in Cairo?

--- final output ---
It is 25°C and sunny in Cairo.
```

If you see that, your key works and the model is reachable. If not, jump to [Troubleshooting](#troubleshooting). (The weather number is faked inside the tool - derived from the city name, not a real lookup - so it never changes. That is expected.)

> Note: this warm-up agent already uses a *tool* under the hood to get the weather - we will unpack exactly what that means in Step 2. For now just confirm you get output; Step 1 starts you from a genuinely tool-free agent.

> Full file: [`openrouter-agent.ts`](../openrouter-agent.ts). It is the same shape you will see in `examples/`, just with the provider setup inlined.

---

## STEP 1 - A bare agent (~15 min)

**File:** [`examples/01-hello-agent.ts`](../examples/01-hello-agent.ts)

### Command

```bash
npm run ex:01
```

### What is happening

This is the simplest possible agent: a model and instructions, no tools. The core is three lines:

```ts
const recruiter = new Agent({
  name: 'Recruiter',
  instructions:
    'You are a concise technical recruiter. ' +
    'Given a candidate blurb, give a 2-sentence read on seniority and fit.',
  model,
});

const result = await run(recruiter, prompt);
console.log(result.finalOutput);
```

- `new Agent({ name, instructions, model })` defines the agent. `instructions` is its system prompt - its personality and job.
- `run(agent, input)` sends your input to the model and returns a **result object**. The result has `finalOutput` (the answer string), `lastAgent` (which agent produced it), and `newItems` (the raw steps). We only print `finalOutput` here.
- `model` comes from [`examples/setup.ts`](../examples/setup.ts), which configures OpenRouter once and is imported by every example.

The prompt comes from the command line, falling back to a default:

```ts
const prompt =
  process.argv.slice(2).join(' ') ||
  'Candidate: 8y TypeScript, maintains a popular open-source state library, ' +
  'ex-Stripe. Fit for a senior platform role?';
```

`process.argv.slice(2)` is everything you type after the script name.

### You should see

```
This candidate shows strong senior-level signals: 8 years of TypeScript plus
maintaining a popular open-source library demonstrates deep expertise and
community impact. Combined with Stripe experience, they look like a solid fit
for a senior platform role.
```

(The exact wording will vary run to run - LLMs are non-deterministic. The shape - a 2-sentence seniority read - should be stable.)

### Mini-exercise

1. **Change the personality.** Edit the `instructions` to make the recruiter blunt and skeptical (e.g. add `"Be skeptical. Point out one risk."`). Re-run `npm run ex:01` and watch the tone change.
2. **Pass your own prompt as arguments.** Anything after `--` is forwarded to the script:

   ```bash
   npm run ex:01 -- Candidate: 2y Python, lots of small scripts, no public repos. Senior backend?
   ```

   You should get a much more cautious read. Notice you did **not** edit the file - you changed the agent's behavior just by changing its input.

---

## STEP 2 - Give the agent a tool (~30 min)

**File:** [`examples/02-custom-tool.ts`](../examples/02-custom-tool.ts)

### Command

```bash
npm run ex:02
```

### What is happening

Now the agent can *do* something: fetch a real GitHub profile. We define a tool with `tool({ ... })`:

```ts
const getGithubProfile = tool({
  name: 'get_github_profile',
  description: 'Fetch a public GitHub profile by username (login).',
  parameters: z.object({
    login: z.string().describe('GitHub username, e.g. "gaearon"'),
  }),
  async execute({ login }) {
    const res = await fetch(`https://api.github.com/users/${login}`, { /* headers */ });
    if (!res.ok) return `GitHub API error ${res.status} for "${login}"`;
    const u = await res.json();
    return JSON.stringify({ login: u.login, name: u.name, followers: u.followers, /* ... */ });
  },
});
```

Three parts matter:

- **`name` + `description`** are how the *model* understands the tool. This text is sent to the model. A good description is the difference between the model calling the tool and ignoring it.
- **`parameters`** is the tool's input schema. It tells the model the argument shape (so it knows to produce a `login` string) **and** validates the arguments at runtime before your code runs. Field descriptions are hints to the model.
- **`execute(args)`** is your plain async function. It receives the validated args and does the work (here a `fetch` to the GitHub REST API). These examples return JSON text so the model can read the fields back; richer tool outputs such as files or images depend on model/provider support.

The agent is given the tool via the `tools` array:

```ts
const scout = new Agent({
  name: 'Scout',
  instructions:
    'You are a technical sourcer. When asked about a GitHub user, ' +
    'call get_github_profile, then give a 2-sentence read on seniority signals.',
  model,
  tools: [getGithubProfile],
});
```

**Key idea: the model decides.** You do not call `get_github_profile` yourself. You hand the tool to the agent; the model reads the user's request, decides it needs the profile, emits a tool call with `{ login: "gaearon" }`, the SDK runs your `execute`, feeds the result back, and the model writes the final answer. That whole loop happens inside one `run(scout, prompt)`.

Note the auth header in the fetch - if `GITHUB_TOKEN` is set it is used, otherwise the call is unauthenticated (and rate-limited):

```ts
...(process.env.GITHUB_TOKEN
  ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
  : {}),
```

### You should see

Running with the default prompt (`What can you tell me about the GitHub user "gaearon"?`):

```
Dan Abramov (gaearon) is a highly influential engineer with a very large
following and many public repositories, signaling deep open-source impact and
senior+ experience. The profile points to a React-ecosystem expert well suited
to senior frontend or developer-experience roles.
```

The follower/repo numbers come from the *live* API, so the read reflects real data. The exact phrasing varies.

### Mini-exercise

Pick **one** and observe how the model's behavior shifts:

1. **Add a field to the tool result.** GitHub's user payload includes more fields. Add `created_at` so the model can reason about account age. **Two edits in `examples/02-custom-tool.ts`:**

   First, add `created_at` to the type annotation on the `await res.json()` line (around lines 21-29 in the file):

   ```ts
   const u = (await res.json()) as {
     login: string;
     name: string | null;
     bio: string | null;
     company: string | null;
     location: string | null;
     created_at: string;          // <-- new
     followers: number;
     public_repos: number;
   };
   ```

   Then add it to the returned object just below:

   ```ts
   return JSON.stringify({
     login: u.login,
     name: u.name,
     bio: u.bio,
     company: u.company,
     location: u.location,
     created_at: u.created_at,   // <-- new
     followers: u.followers,
     public_repos: u.public_repos,
   });
   ```

   (Both blocks already exist in the file - you are adding one line to each. The type edit is what keeps TypeScript happy; without it you would get `Property 'created_at' does not exist`.) Re-run; ask it to mention how long the account has existed.

2. **Tweak the description and watch the model change its mind.** Change the tool description to something vague like `'Maybe gets some GitHub info.'` and re-run. The model may stop calling the tool, or call it less reliably. Then make it sharp again: `'Fetch a public GitHub profile (name, bio, followers, repo count) by username. Use this whenever a GitHub user is mentioned.'` This shows that the description is real, load-bearing prompt engineering.

> Tip: pass a different user with `npm run ex:02 -- Tell me about the GitHub user "torvalds"`.

---

## STEP 3 - Two tools and a memory (~30 min)

**File:** [`examples/03-multi-tool-agent.ts`](../examples/03-multi-tool-agent.ts)

### Command

```bash
npm run ex:03
```

### What is happening

This agent has **two** tools and runs a **3-turn conversation** that remembers earlier turns.

Both tools share a small helper so we do not repeat the headers:

```ts
const gh = (path: string) =>
  fetch(`https://api.github.com${path}`, {
    headers: {
      'User-Agent': 'candidate-scout-workshop',
      Accept: 'application/vnd.github+json',
      ...(process.env.GITHUB_TOKEN
        ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
        : {}),
    },
  });
```

The two tools:

- `search_github_users` - takes a `query` (supports GitHub qualifiers like `language:rust followers:>500`) and a `limit`, returns matching logins.
- `get_user_repos` - takes a `login`, returns that user's top-5 most-starred repos.

The agent is given both:

```ts
const sourcing = new Agent({
  name: 'Sourcing Assistant',
  instructions:
    'You help build a candidate shortlist. Use search_github_users to find people ' +
    'and get_user_repos to inspect their work. Keep a running shortlist and refer ' +
    'back to it when asked.',
  model,
  tools: [searchGithubUsers, getUserRepos],
});
```

**Memory** is the new piece. A `MemorySession` retains conversation history, and passing it as the third arg to `run` lets each turn see the previous ones:

```ts
const session = new MemorySession();

const turns = [
  'Find 3 Rust developers with a strong following.',
  "Look at the top one's repositories.",
  'Add them to my shortlist and tell me who we have so far.',
];

for (const turn of turns) {
  const result = await run(sourcing, turn, { session });   // <-- { session } shares memory
  console.log(`\n> ${turn}\n${result.finalOutput}`);
}
```

Without `{ session }`, turn 2 (`"Look at the top one's repositories"`) would have no idea who "the top one" is. With it, the agent remembers the list from turn 1.

### You should see

Three labelled turns. Roughly:

```
> Find 3 Rust developers with a strong following.
Here are three Rust developers with large followings: 1) BurntSushi, 2) ...

> Look at the top one's repositories.
BurntSushi's most-starred repos include ripgrep, xsv, and ...

> Add them to my shortlist and tell me who we have so far.
Your shortlist so far: BurntSushi (ripgrep, ...). Want me to add the other two?
```

The specific people and repos come from the live search, so they will differ. What matters: **turn 2 and turn 3 refer back to earlier turns** - that is the session working.

### Mini-exercise (optional - only if you are ahead of schedule)

> If you are short on time, skip this and go straight to the Stretch, which covers the same skill (authoring a tool) more fully. **The must-finish line for this lab is Step 3 running as-is.**

**Add a third tool: `get_user_gists`.** Gists are a quick signal of how much someone shares small code snippets. The endpoint is `GET /users/{login}/gists`.

1. Define it next to the others:

   ```ts
   const getUserGists = tool({
     name: 'get_user_gists',
     description: "List a user's public gists (id, description).",
     parameters: z.object({ login: z.string() }),
     async execute({ login }) {
       const res = await gh(`/users/${login}/gists?per_page=10`);
       if (!res.ok) return `GitHub gists error ${res.status}`;
       const gists = (await res.json()) as Array<{
         id: string;
         description: string | null;
       }>;
       return JSON.stringify(
         gists.map((g) => ({ id: g.id, description: g.description })),
       );
     },
   });
   ```

2. Register it: `tools: [searchGithubUsers, getUserRepos, getUserGists]`.
3. Update the instructions so the model knows when to reach for it, e.g. add: `'Use get_user_gists to see what snippets they share publicly.'`
4. Add a turn that triggers it, like `"Show me the top candidate's public gists."`, and re-run.

You just expanded an agent's capabilities by adding one function and one sentence of instruction.

---

## STRETCH - Write a tool from scratch (~15 min, optional - only if time)

Write a **brand-new** tool that hits a GitHub REST endpoint we have not used, and wire it into an agent. A good target: a user's **followers** list, `GET /users/{login}/followers` - useful for "who is in this person's orbit?".

Start from `examples/02-custom-tool.ts` (it is the smallest). Add:

```ts
const getUserFollowers = tool({
  name: 'get_user_followers',
  description: "List a GitHub user's followers (logins). Use to gauge reach.",
  parameters: z.object({
    login: z.string().describe('GitHub username'),
    limit: z.number().int().min(1).max(30).default(10),
  }),
  async execute({ login, limit }) {
    const res = await fetch(
      `https://api.github.com/users/${login}/followers?per_page=${limit}`,
      {
        headers: {
          'User-Agent': 'candidate-scout-workshop',
          ...(process.env.GITHUB_TOKEN
            ? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
            : {}),
        },
      },
    );
    if (!res.ok) return `GitHub followers error ${res.status} for "${login}"`;
    const users = (await res.json()) as Array<{ login: string }>;
    return JSON.stringify(users.map((u) => u.login));
  },
});
```

Then add it to the agent's `tools` array and mention it in the instructions, and run with a prompt that should trigger it (e.g. `npm run ex:02 -- Who follows the GitHub user "gaearon"?`).

**Checklist for any tool you write:**
- [ ] Clear `name` and `description` (the model reads these).
- [ ] `parameters` is a `z.object({ ... })`; describe non-obvious fields.
- [ ] `execute` returns a **string** (use `JSON.stringify` for structured data).
- [ ] Handle the error case (`if (!res.ok) return "...error..."`) so a bad request does not crash the run.
- [ ] Added to the agent's `tools` array **and** referenced in `instructions`.

**Bonus challenges if you finish early:**
- Add a `get_repo_languages` tool (`GET /repos/{owner}/{repo}/languages`) and ask the agent which languages a repo uses.
- Give your stretch tool a `MemorySession` like Step 3 so you can ask follow-up questions about the same candidate.

---

## Troubleshooting

| Symptom | Cause | Fix |
| --- | --- | --- |
| `Missing OPENROUTER_API_KEY. Copy .env.example -> .env and fill it in.` then exit | No key loaded | Make sure `.env` exists (`cp .env.example .env`) and contains `OPENROUTER_API_KEY=sk-or-...`. The scripts already pass `--env-file=.env`, so the file must be in the project root. |
| `401` / auth error from OpenRouter | Bad or revoked key | Re-copy the key from https://openrouter.ai/keys. No stray spaces or quotes around it in `.env`. |
| Tool returns `GitHub ... error 403` (or `429`) | Unauthenticated GitHub REST is capped at ~60 requests/hour | Add a `GITHUB_TOKEN` to `.env` (https://github.com/settings/tokens, no scopes needed - the lab only reads public data). This raises the limit to ~5000/hour. The tools auto-use it via the `Authorization` header. Wait a few minutes if you have already been rate-limited. |
| Tool returns `GitHub ... error 401` | You left the placeholder `GITHUB_TOKEN=ghp_...` in `.env` (an invalid token) | Either paste a real token or **delete the `GITHUB_TOKEN` line entirely** - an invalid token is rejected, but no token still works at the lower rate limit. |
| `404` from a GitHub tool | Username/repo does not exist, or a typo in the path | Check the `login` you passed; try a known account like `gaearon` or `torvalds`. |
| The model answers from its own knowledge and **never calls the tool** | Weak tool `description`, or instructions do not tell it to use the tool | Sharpen the `description` ("Use this whenever a GitHub user is mentioned") and add an explicit instruction like "When asked about a GitHub user, call get_github_profile first." Smaller models need clearer nudges. |
| `Cannot find module` / TypeScript error on run | Dependencies not installed, or wrong Node | Run `npm install`; confirm `node --version` is 20+. The scripts use `--import tsx`, so you do **not** need to compile first. |
| Want to check types without running | - | `npm run typecheck` runs `tsc --noEmit`. |
| Output looks different every run | Normal | LLMs are non-deterministic. Judge by **shape** (did it call the right tool? is the answer the right kind of thing?), not exact words. |

---

## Recap

You now know the three building blocks you will use for the rest of the day:
1. **Agent + run + finalOutput** - the basic loop (Step 1).
2. **tool() + input schema + execute, and the model deciding when to call** (Step 2).
3. **Multiple tools + MemorySession for multi-turn memory** (Step 3), plus how to author a tool from scratch (Stretch).

After lunch, Lab 2 swaps your hand-written tools for a real **MCP server** and connects several agents together. See you at 14:00.
