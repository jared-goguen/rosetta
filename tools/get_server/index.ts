import { readServer, getRoot } from "../../src/scanner.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export async function getServer(input: { name: string }) {
  const root = getRoot();
  
  try {
    const server = await readServer(input.name, root);
    return {
      content: [{
        type: "text",
        text: JSON.stringify(server.metadata, null, 2),
      }],
    };
  } catch (error: any) {
    throw new McpError(
      ErrorCode.InvalidRequest,
      `Server not found: ${input.name}`
    );
  }
}
