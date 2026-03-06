import { mkdtemp, mkdir, rm } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";

export async function makeRoot(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), "rosetta-test-"));
  await mkdir(join(root, "tools"), { recursive: true });
  await mkdir(join(root, "commands"), { recursive: true });
  await mkdir(join(root, "plugins"), { recursive: true });
  return root;
}

export async function cleanRoot(root: string): Promise<void> {
  await rm(root, { recursive: true, force: true });
}

export const FIXTURES_ROOT = new URL("../fixtures", import.meta.url).pathname;
