import { Agent, MCPServerStdio, run } from '@openai/agents';
import model from './model.ts';

const token = process.env.GITHUB_TOKEN;
if (!token) {
	console.error(`This example needs GITHUB_TOKEN (a GitHub PAT) in your .env.`);
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
	const tools = await github.listTools();
	console.log(
		`> github MCP exposed ${tools.length} tools, e.g. ${tools
			.slice(0, 5)
			.map((t) => t.name)
			.join(`, `)}`,
	);

	const scout = new Agent({
		name: `Scout`,
		instructions: `You are a technical sourcer. Use the GitHub tools to research candidates and repositories. Be concise and cite the data you used.`,
		model,
		mcpServers: [github],
	});

	const prompt =
		process.argv.slice(2).join(` `) ||
		`Find popular TypeScript repos about "ai agents" and name two active contributors worth reaching out to.`;

	const result = await run(scout, prompt);
	console.log(`\n--- result ---\n${result.finalOutput}`);
} finally {
	await github.close();
}
