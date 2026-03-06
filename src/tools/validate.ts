import { validateTool, validateCommand, validatePlugin } from "../validator.js";
import { getRoot } from "../scanner.js";
import { McpError, ErrorCode } from "@modelcontextprotocol/sdk/types.js";

export async function validate(input: { type: "tool" | "command" | "plugin"; name: string }) {
  const root = getRoot();
  let result;
  if (input.type === "tool") result = await validateTool(input.name, root);
  else if (input.type === "command") result = await validateCommand(input.name, root);
  else if (input.type === "plugin") result = await validatePlugin(input.name, root);
  else throw new McpError(ErrorCode.InvalidParams, `Unknown type: ${(input as any).type}`);
  return { content: [{ type: "text" as const, text: JSON.stringify(result) }] };
}
