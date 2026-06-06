import {
	Agent,
	OpenAIProvider,
	run,
	setDefaultModelProvider,
	setTracingDisabled,
	tool,
} from '@openai/agents';
import { z } from 'zod';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
	console.error(
		'Missing OPENROUTER_API_KEY. Copy .env.example -> .env and fill it in.',
	);
	process.exit(1);
}

const model = process.env.OPENROUTER_MODEL ?? 'deepseek/deepseek-v4-flash';

setDefaultModelProvider(
	new OpenAIProvider({
		apiKey,
		baseURL: 'https://openrouter.ai/api/v1',
		useResponses: true,
	}),
);
setTracingDisabled(true);

const getWeather = tool({
	name: 'get_weather',
	description: 'Get the current weather for a city.',
	parameters: z.object({
		city: z.string().describe('City name, e.g. "Cairo"'),
	}),
	async execute({ city }) {
		const tempC = 20 + (city.length % 10);
		return `It is ${tempC}°C and sunny in ${city}.`;
	},
});

const agent = new Agent({
	name: 'Workshop Assistant',
	instructions:
		'You are concise. When asked about weather, call the get_weather tool, ' +
		'then answer in one sentence.',
	model,
	tools: [getWeather],
});

const prompt =
	process.argv.slice(2).join(' ') || "What's the weather in Cairo?";

console.log(`> model: ${model}`);
console.log(`> prompt: ${prompt}\n`);

const result = await run(agent, prompt);

console.log('--- final output ---');
console.log(result.finalOutput);
