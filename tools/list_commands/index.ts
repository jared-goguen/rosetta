import { scanCommands, getRoot } from "../../src/scanner.js";

export async function listCommands() {
  const commands = await scanCommands(getRoot());
  const result = commands.map(c => ({ name: c.name, description: c.description }));
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}