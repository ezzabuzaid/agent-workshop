import { Agent, run } from '@openai/agents';
import model from './model.ts';

const sourcing = new Agent({
	name: `Sourcing Specialist`,
	handoffDescription: `Finds NEW candidates from criteria like role, stack, and location.`,
	instructions: `You propose 3 candidate archetypes and where on GitHub to find them. Be specific and brief.`,
	model,
});

const screening = new Agent({
	name: `Screening Specialist`,
	handoffDescription: `Evaluates a KNOWN, specific candidate against a role.`,
	instructions: `You assess the named candidate against the role and give a clear hire / no-hire recommendation with two reasons.`,
	model,
});

const coordinator = new Agent({
	name: `Hiring Coordinator`,
	instructions: `You route recruiting requests and never answer directly. If the user wants to FIND people, hand off to the Sourcing Specialist. If they want to EVALUATE a specific person, hand off to the Screening Specialist.`,
	model,
	handoffs: [sourcing, screening],
});

const prompt =
	process.argv.slice(2).join(` `) ||
	`I have a candidate, "Dana", who built a distributed cache in Go. Are they a fit for a senior backend role?`;

const result = await run(coordinator, prompt);

console.log(`handled by: ${result.lastAgent?.name}\n`);
console.log(result.finalOutput);
