import { scanTools, getRoot } from "../../src/scanner.js";

export async function listTools() {
  const tools = await scanTools(getRoot());
  const result = tools.map(t => ({ name: t.name, description: t.description }));
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}