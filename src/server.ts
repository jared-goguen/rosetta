import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getSchema } from "./tools/schema.js";
import { validate } from "./tools/validate.js";
import { listTools, getTool, addTool, updateTool, removeTool } from "./tools/tools.js";
import { listCommands, getCommand, addCommand, updateCommand, removeCommand } from "./tools/commands.js";
import { listPlugins, getPlugin, addPlugin, updatePlugin, removePlugin, enablePlugin, disablePlugin } from "./tools/plugins.js";

// JSON Schema values are pass-through — we use z.unknown() rather than z.record()
// because Zod v4 changed z.record() internals and the MCP SDK's schema compiler
// doesn't handle it correctly for nested objects.
const AnyObject = z.unknown();

export function createServer(): McpServer {
  const server = new McpServer({ name: "rosetta", version: "0.1.0" });

  // Schema
  server.tool("get_schema", "Return the full Rosetta schema bundle", {}, getSchema);

  server.tool("validate", "Validate an artifact's structure and schema", {
    type: z.enum(["tool", "command", "plugin"]),
    name: z.string(),
  }, validate);

  // Tools
  server.tool("list_tools", "List all discovered tools", {}, listTools);
  server.tool("get_tool", "Get a tool's full definition", { name: z.string() }, getTool);
  server.tool("add_tool", "Create a new tool", {
    name: z.string(),
    content: z.string(),
    description: z.string().optional(),
    schema: z.object({ input: AnyObject, output: AnyObject }).optional(),
  }, addTool);
  server.tool("update_tool", "Update an existing tool", {
    name: z.string(),
    content: z.string().optional(),
    description: z.string().optional(),
    schema: z.object({ input: AnyObject.optional(), output: AnyObject.optional() }).optional(),
  }, updateTool);
  server.tool("remove_tool", "Remove a tool", { name: z.string() }, removeTool);

  // Commands
  server.tool("list_commands", "List all discovered commands", {}, listCommands);
  server.tool("get_command", "Get a command's full definition", { name: z.string() }, getCommand);
  server.tool("add_command", "Create a new command", {
    name: z.string(),
    content: z.string(),
    description: z.string().optional(),
    schema: AnyObject.optional(),
  }, addCommand);
  server.tool("update_command", "Update an existing command", {
    name: z.string(),
    content: z.string().optional(),
    description: z.string().optional(),
    schema: AnyObject.optional(),
  }, updateCommand);
  server.tool("remove_command", "Remove a command", { name: z.string() }, removeCommand);

  // Plugins
  server.tool("list_plugins", "List all discovered plugins", {}, listPlugins);
  server.tool("get_plugin", "Get a plugin's full definition", { name: z.string() }, getPlugin);
  server.tool("add_plugin", "Create a new plugin", {
    name: z.string(),
    content: z.string(),
    manifest: z.object({
      version: z.string(),
      description: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
    }),
    files: z.record(z.string(), z.string()).optional(),
  }, addPlugin);
  server.tool("update_plugin", "Update an existing plugin", {
    name: z.string(),
    content: z.string().optional(),
    manifest: z.object({
      name: z.string().optional(),
      version: z.string().optional(),
      description: z.string().optional(),
      entry: z.string().optional(),
      dependencies: z.array(z.string()).optional(),
      enabled: z.boolean().optional(),
    }).optional(),
    files: z.record(z.string(), z.string()).optional(),
  }, updatePlugin);
  server.tool("remove_plugin", "Remove a plugin", { name: z.string() }, removePlugin);
  server.tool("enable_plugin", "Enable a plugin", { name: z.string() }, enablePlugin);
  server.tool("disable_plugin", "Disable a plugin", { name: z.string() }, disablePlugin);

  return server;
}
