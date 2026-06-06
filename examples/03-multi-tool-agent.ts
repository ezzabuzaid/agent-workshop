import { Agent, MemorySession, run, tool } from '@openai/agents';
import { z } from 'zod';
import model from './model.ts';

const gh = (path: string) =>
	fetch(`https://api.github.com${path}`, {
		headers: {
			'User-Agent': `candidate-scout-workshop`,
			Accept: `application/vnd.github+json`,
			...(process.env.GITHUB_TOKEN
				? { Authorization: `Bearer ${process.env.GITHUB_TOKEN}` }
				: {}),
		},
	});

const searchGithubUsers = tool({
	name: `search_github_users`,
	description: `Search GitHub users. Supports qualifiers, e.g. "language:rust location:berlin followers:>500".`,
	parameters: z.object({
		query: z.string(),
		limit: z.number().int().min(1).max(10).default(5),
	}),
	async execute({ query, limit }) {
		const res = await gh(
			`/search/users?q=${encodeURIComponent(query)}&per_page=${limit}`,
		);
		if (!res.ok) return `GitHub search error ${res.status}`;
		const data = (await res.json()) as {
			items?: { login: string; html_url: string }[];
		};
		return JSON.stringify(
			(data.items ?? []).map((i) => ({ login: i.login, url: i.html_url })),
		);
	},
});

const getUserRepos = tool({
	name: `get_user_repos`,
	description: `List a user's most-starred public repositories.`,
	parameters: z.object({ login: z.string() }),
	async execute({ login }) {
		const res = await gh(`/users/${login}/repos?per_page=100&type=owner`);
		if (!res.ok) return `GitHub repos error ${res.status}`;
		const repos = (await res.json()) as Array<{
			name: string;
			stargazers_count: number;
			language: string | null;
		}>;
		const top = repos
			.sort((a, b) => b.stargazers_count - a.stargazers_count)
			.slice(0, 5)
			.map((r) => ({
				name: r.name,
				stars: r.stargazers_count,
				lang: r.language,
			}));
		return JSON.stringify(top);
	},
});

const sourcing = new Agent({
	name: `Sourcing Assistant`,
	instructions: `You help build a candidate shortlist. Use search_github_users to find people and get_user_repos to inspect their work. Keep a running shortlist and refer back to it when asked.`,
	model,
	tools: [searchGithubUsers, getUserRepos],
});

const session = new MemorySession();

const turns = [
	`Find 3 Rust developers with a strong following.`,
	`Look at the top one's repositories.`,
	`Add them to my shortlist and tell me who we have so far.`,
];

for (const turn of turns) {
	const result = await run(sourcing, turn, { session });
	console.log(`\n> ${turn}\n${result.finalOutput}`);
}
