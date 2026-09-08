import { existsSync } from "node:fs";
import { mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WriteFileTool } from "../src/core/tools/WriteFileTool.js";
import { writeFileInputSchema } from "../src/core/tools/WriteFileTool.js";

import { createTempDir, removeTempDir } from "./toolTestUtils.js";

describe("WriteFileTool", () => {
  let root: string;

  beforeEach(async () => {
    root = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(root);
  });

  it("creates a file with the given content", async () => {
    const tool = new WriteFileTool(root);

    const result = await tool.execute({
      path: "output.txt",
      content: "hello",
    });

    expect(result).toEqual({ path: "output.txt", bytesWritten: 5 });
    expect(await readFile(join(root, "output.txt"), "utf8")).toBe("hello");
  });

  it("overwrites an existing file", async () => {
    await writeFile(join(root, "output.txt"), "old", "utf8");

    const tool = new WriteFileTool(root);

    await tool.execute({ path: "output.txt", content: "new" });

    expect(await readFile(join(root, "output.txt"), "utf8")).toBe("new");
  });

  it("creates parent directories for nested paths", async () => {
    const tool = new WriteFileTool(root);

    const result = await tool.execute({
      path: "a/b/c/deep.txt",
      content: "deep",
    });

    expect(result).toEqual({ path: "a/b/c/deep.txt", bytesWritten: 4 });
    expect(
      await readFile(join(root, "a", "b", "c", "deep.txt"), "utf8"),
    ).toBe("deep");
  });

  it("rejects an empty path at the schema level", () => {
    expect(() =>
      writeFileInputSchema.parse({ path: "", content: "x" }),
    ).toThrow();
  });

  it("rejects non-string content at the schema level", () => {
    expect(() =>
      writeFileInputSchema.parse({ path: "a.txt", content: 42 }),
    ).toThrow();
  });

  it("rejects absolute paths", async () => {
    const tool = new WriteFileTool(root);

    await expect(
      tool.execute({ path: "/tmp/evil.txt", content: "x" }),
    ).rejects.toThrow(/Absolute paths are not allowed/);
  });

  it("rejects paths that escape the working directory", async () => {
    const sandbox = await createTempDir();

    try {
      const workspace = join(sandbox, "workspace");
      await mkdir(workspace);

      const tool = new WriteFileTool(workspace);

      await expect(
        tool.execute({ path: "../evil.txt", content: "x" }),
      ).rejects.toThrow(/escapes the working directory/);

      await expect(
        tool.execute({
          path: join("a", "..", "..", "evil.txt"),
          content: "x",
        }),
      ).rejects.toThrow(/escapes the working directory/);

      expect(existsSync(join(sandbox, "evil.txt"))).toBe(false);
    } finally {
      await removeTempDir(sandbox);
    }
  });

  it("refuses to write through a symlinked directory", async () => {
    const sandbox = await createTempDir();

    try {
      const workspace = join(sandbox, "workspace");
      const outsideDir = join(sandbox, "outside");

      await mkdir(workspace);
      await mkdir(outsideDir);
      await symlink(outsideDir, join(workspace, "linkdir"));

      const tool = new WriteFileTool(workspace);

      await expect(
        tool.execute({ path: "linkdir/evil.txt", content: "x" }),
      ).rejects.toThrow(/escapes the working directory/);

      expect(existsSync(join(outsideDir, "evil.txt"))).toBe(false);
    } finally {
      await removeTempDir(sandbox);
    }
  });
});
