import { Agent, run } from '@openai/agents';
import model from './model.ts';

const recruiter = new Agent({
	name: `Recruiter`,
	instructions: `You are a concise technical recruiter. Given a candidate blurb, give a 2-sentence read on seniority and fit.`,
	model,
});

const goal = `Candidate: 8y TypeScript, maintains a popular open-source state library, ex-Stripe. are they fit for a senior platform role?`;

const result = await run(recruiter, goal);

console.log(result.finalOutput);
