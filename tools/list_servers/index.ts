import { scanServers, getRoot } from "../../src/scanner.js";

export async function listServers(input: Record<string, unknown>) {
  const root = getRoot();
  const servers = await scanServers(root);
  
  const summaries = servers.map(s => ({
    name: s.metadata.name,
    type: s.metadata.type,
    description: s.metadata.description,
    enabled: s.metadata.enabled,
    tools: s.metadata.tools,
  }));

  return {
    content: [{
      type: "text",
      text: JSON.stringify(summaries, null, 2),
    }],
  };
}
