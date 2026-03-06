import { rebuildBundle } from "../bundle.js";
import { getRoot } from "../scanner.js";

export async function getSchema() {
  const root = getRoot();
  const schema = await rebuildBundle(root);
  return { content: [{ type: "text" as const, text: JSON.stringify(schema, null, 2) }] };
}
