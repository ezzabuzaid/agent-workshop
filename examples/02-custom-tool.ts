import { execSync } from 'node:child_process';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import model from './model.ts';

function resolveGithubToken(): string {
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
	try {
		return execSync(`gh auth token`, {
			stdio: [`ignore`, `pipe`, `ignore`],
		})
			.toString()
			.trim();
	} catch {
		return ``;
	}
}

const githubToken = resolveGithubToken();

const getGithubProfile = tool({
	name: `get_github_profile`,
	description: `Fetch a public GitHub profile by username (login).`,
	parameters: z.object({
		login: z.string().describe(`GitHub username, e.g. "gaearon"`),
	}),
	async execute({ login }) {
		const res = await fetch(`https://api.github.com/users/${login}`, {
			headers: {
				'User-Agent': `candidate-scout-workshop`,
				...(githubToken ? { Authorization: `Bearer ${githubToken}` } : {}),
			},
		});
		if (!res.ok) return `GitHub API error ${res.status} for "${login}"`;
		const u = (await res.json()) as {
			login: string;
			name: string | null;
			bio: string | null;
			company: string | null;
			location: string | null;
			followers: number;
			public_repos: number;
		};
		return JSON.stringify({
			login: u.login,
			name: u.name,
			bio: u.bio,
			company: u.company,
			location: u.location,
			followers: u.followers,
			public_repos: u.public_repos,
		});
	},
});

const scout = new Agent({
	name: `Scout`,
	instructions: `You are a technical sourcer. go through this steps to research a GitHub user:
1. Call the get_github_profile tool with the user's login.
2. Based on the profile data, write a concise 2-sentence summary of the user's seniority and fit for a senior TypeScript role.`,
	model,
	tools: [getGithubProfile],
});

const prompt = `What can you tell me about the GitHub user "ezzabuzaid"?`;

const result = await run(scout, prompt);

console.log(result.finalOutput);
