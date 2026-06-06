import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import model from './model.ts';

const getGithubProfile = tool({
	name: `get_github_profile`,
	description: `Fetch a public GitHub profile by username (login).`,
	parameters: z.object({ login: z.string() }),
	async execute({ login }) {
		const res = await fetch(`https://api.github.com/users/${login}`, {
			headers: {
				'User-Agent': `candidate-scout-workshop`,
				...(process.env.GITHUB_TOKEN
					? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
					: {}),
			},
		});
		if (!res.ok) return `GitHub API error ${res.status} for "${login}"`;
		const u = (await res.json()) as {
			login: string;
			name: string | null;
			bio: string | null;
			followers: number;
			public_repos: number;
		};
		return JSON.stringify(u);
	},
});

const screener = new Agent({
	name: `Screener`,
	instructions: `You evaluate ONE GitHub candidate for a senior TypeScript role. Call get_github_profile, then reply with exactly one line: "<login>: <hire|maybe|pass> - <one-clause reason>".`,
	model,
	tools: [getGithubProfile],
});

const ranker = new Agent({
	name: `Ranker`,
	instructions: `Given several one-line candidate verdicts, return a numbered shortlist, best candidate first, with a half-line justification each.`,
	model,
});

const logins = process.argv.slice(2);
const candidates = logins.length
	? logins
	: [`gaearon`, `sindresorhus`, `tannerlinsley`];

console.log(
	`> scatter: screening ${candidates.length} candidates in parallel...`,
);

const verdicts = await Promise.all(
	candidates.map(async (login) => {
		const r = await run(screener, `Evaluate the GitHub user "${login}".`);
		return r.finalOutput ?? `${login}: (no verdict)`;
	}),
);

console.log(`\n--- gathered verdicts ---`);
for (const v of verdicts) console.log(v);

const ranked = await run(
	ranker,
	`Rank these candidates:\n${verdicts.join(`\n`)}`,
);
console.log(`\n--- ranked shortlist ---\n${ranked.finalOutput}`);
