import {
	Agent,
	MemorySession,
	OpenAIProvider,
	run,
	setDefaultModelProvider,
	setTracingDisabled,
} from '@openai/agents';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
	console.error(
		'Missing OPENROUTER_API_KEY. Copy .env.example -> .env and fill it in.',
	);
	process.exit(1);
}

setDefaultModelProvider(
	new OpenAIProvider({
		apiKey,
		baseURL: 'https://openrouter.ai/api/v1',
		useResponses: true,
	}),
);
setTracingDisabled(true);

const agent = new Agent({
	name: 'Memory Demo',
	instructions: 'You are concise. Answer in one short sentence.',
	model: 'deepseek/deepseek-v4-flash',
});

const session = new MemorySession();

const turns = [
	'My name is Ezz and my favorite language is TypeScript.',
	'What is my name?',
	'And what is my favorite language?',
];

for (const turn of turns) {
	const result = await run(agent, turn, { session });
	console.log(`> ${turn}`);
	console.log(`  ${result.finalOutput}\n`);
}

const stored = await session.getItems();
console.log(`session retained ${stored.length} history items across the turns`);
