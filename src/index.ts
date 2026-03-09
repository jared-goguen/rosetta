import { serve } from "mcp-core";

await serve({
  name: "rosetta",
  version: "0.1.0",
  serverDir: import.meta.dir,
});