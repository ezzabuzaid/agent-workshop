import { Agent, run } from '@openai/agents';
import { webSearchTool } from '@openai/agents-openai';
import model from './model.ts';

const researcher = new Agent({
	name: `Web Researcher`,
	instructions: `You are a concise researcher. Use web_search to answer with:
1) a 3-bullet summary
2) 2-3 source URLs
Keep the answer under 120 words.`,
	model,
	tools: [webSearchTool({ searchContextSize: `low` })],
});

const prompt = `Search for AI devs in Amman via GitHub?`;

const result = await run(researcher, prompt);

console.log(result.finalOutput);
