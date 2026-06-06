import { Agent, MCPServerStdio, run } from '@openai/agents';
import model from './model.ts';

const token = process.env.GITHUB_TOKEN;
if (!token) {
	console.error(`The capstone needs GITHUB_TOKEN (a GitHub PAT) in your .env.`);
	process.exit(1);
}

const github = new MCPServerStdio({
	name: `github`,
	command: process.env.GITHUB_MCP_CMD ?? `npx`,
	args: process.env.GITHUB_MCP_ARGS?.split(` `) ?? [
		`-y`,
		`@modelcontextprotocol/server-github`,
	],
	env: { GITHUB_PERSONAL_ACCESS_TOKEN: token },
	cacheToolsList: true,
});

await github.connect();
try {
	// agents-as-tools: a focused writer the screening agent can call on demand.
	const reportWriter = new Agent({
		name: `Report Writer`,
		instructions: `Turn raw notes about a candidate into a tight 4-line outreach brief: Name, Signal, Risk, Suggested message.`,
		model,
	});

	const sourcing = new Agent({
		name: `Sourcing Specialist`,
		handoffDescription: `Finds new candidates on GitHub from a role brief.`,
		instructions: `Use the GitHub tools to find 3 plausible candidates for the role, with one line each on why they fit.`,
		model,
		mcpServers: [github],
	});

	const screening = new Agent({
		name: `Screening Specialist`,
		handoffDescription: `Researches one named candidate and writes an outreach brief.`,
		instructions: `Use the GitHub tools to research the named candidate, then call the write_outreach_brief tool to produce the final brief.`,
		model,
		mcpServers: [github],
		tools: [
			reportWriter.asTool({
				toolName: `write_outreach_brief`,
				toolDescription: `Turn candidate notes into a 4-line outreach brief.`,
			}),
		],
	});

	const coordinator = new Agent({
		name: `Hiring Coordinator`,
		instructions: `Route recruiting requests, never answer directly. FIND people -> Sourcing Specialist. EVALUATE a specific person -> Screening Specialist.`,
		model,
		handoffs: [sourcing, screening],
	});

	const prompt =
		process.argv.slice(2).join(` `) ||
		`Research the GitHub user "gaearon" for a senior frontend platform role and draft an outreach brief.`;

	const result = await run(coordinator, prompt);
	console.log(`handled by: ${result.lastAgent?.name}\n`);
	console.log(result.finalOutput);
} finally {
	await github.close();
}
