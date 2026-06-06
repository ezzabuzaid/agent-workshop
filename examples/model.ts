import {
	OpenAIProvider,
	setDefaultModelProvider,
	setTracingDisabled,
} from '@openai/agents';

const apiKey = process.env.OPENROUTER_API_KEY;
if (!apiKey) {
	console.error(
		`Missing OPENROUTER_API_KEY. Copy .env.example -> .env and fill it in.`,
	);
	process.exit(1);
}

const model = process.env.OPENROUTER_MODEL ?? `deepseek/deepseek-v4-flash`;
export default model;

setDefaultModelProvider(
	new OpenAIProvider({
		apiKey,
		baseURL: `https://openrouter.ai/api/v1`,
		useResponses: true,
	}),
);
setTracingDisabled(true);
