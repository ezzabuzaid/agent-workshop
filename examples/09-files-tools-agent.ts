import { Agent, run, tool } from '@openai/agents';
import { readdir, readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { z } from 'zod';
import model from './model.ts';

const workspaceRoot = process.cwd();
const MAX_FILE_BYTES = 120 * 1024;
const MAX_QUERY_MATCHES = 60;

function resolveInsideWorkspace(relativePath: string) {
	const absolute = resolve(workspaceRoot, relativePath);
	const rootWithSlash = workspaceRoot.endsWith(`/`)
		? workspaceRoot
		: `${workspaceRoot}/`;
	if (absolute !== workspaceRoot && !absolute.startsWith(rootWithSlash)) {
		throw new Error(`Path must be inside the workspace root.`);
	}
	return absolute;
}

const listFiles = tool({
	name: `list_files`,
	description: `List files and folders for a directory inside the current workspace.`,
	parameters: z.object({
		dir: z.string().default(`.`),
		limit: z.number().int().min(1).max(200).default(50),
	}),
	async execute({ dir, limit }) {
		try {
			const absolute = resolveInsideWorkspace(dir);
			const entries = await readdir(absolute, { withFileTypes: true });
			const rows = entries
				.sort((a, b) => a.name.localeCompare(b.name))
				.slice(0, limit)
				.map((entry) =>
					entry.isDirectory()
						? { name: entry.name, type: `dir` }
						: { name: entry.name, type: `file` },
				);

				if (rows.length > 100) {
					return `Directory "${dir}" has ${entries.length} entries, which exceeds the limit of ${limit}. Showing the first ${limit} entries:\n` + JSON.stringify(rows, null, 2);
				}

			return JSON.stringify({
				dir,
				count: rows.length,
				entries: rows,
			});
		} catch (error) {
			return `list_files error: ${
				error instanceof Error ? error.message : String(error)
			}`;
		}
	},
});

const readFileTool = tool({
	name: `read_file`,
	description: `Read a text file inside the workspace. Optionally provide query to search matching lines.`,
	parameters: z.object({
		path: z.string(),
		query: z.string().min(1).max(200).optional(),
	}),
	async execute({ path, query }) {
		try {
			const absolute = resolveInsideWorkspace(path);
			const info = await stat(absolute);
			if (!info.isFile()) {
				return `"${path}" is not a file. it is a directory.`;
			}
			if (info.size > MAX_FILE_BYTES) {
				return `read_file error: "${path}" is ${info.size} bytes, above the ${MAX_FILE_BYTES}-byte safety limit.`;
			}
			const text = await readFile(absolute, `utf8`);

			if (!query) {
				return text;
			}

			const needle = query.toLowerCase();
			const lines = text.split(`\n`);
			const matches = lines
				.map((line, index) => ({
					lineNumber: index + 1,
					text: line,
				}))
				.filter((line) => line.text.toLowerCase().includes(needle));

			return JSON.stringify({
				path,
				query,
				matchCount: matches.length,
				matches: matches.slice(0, MAX_QUERY_MATCHES),
				truncated: matches.length > MAX_QUERY_MATCHES,
			});
		} catch (error) {
			return `read_file error: ${
				error instanceof Error ? error.message : String(error)
			}`;
		}
	},
});

const repoAssistant = new Agent({
	name: `FileExplorerer`,
	instructions: `You help users explore this repository.
Use list_files to discover directories and use read_file to inspect relevant files before answering.
Keep answers concise and practical.`,
	model,
	tools: [listFiles, readFileTool],
});

const prompt =
	process.argv.slice(2).join(` `) ||
	`List files in the examples directory, then search for "webSearchTool" in 08-web-search-tool.ts and summarize what you find.`;

const result = await run(repoAssistant, prompt);

console.log(result.finalOutput);
