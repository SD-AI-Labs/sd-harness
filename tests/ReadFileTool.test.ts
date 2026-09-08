import { mkdir, rm, symlink, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { ReadFileTool } from "../src/core/tools/ReadFileTool.js";
import { readFileInputSchema } from "../src/core/tools/ReadFileTool.js";

import { createTempDir, removeTempDir } from "./toolTestUtils.js";

describe("ReadFileTool", () => {
  let root: string;

  beforeEach(async () => {
    root = await createTempDir();
  });

  afterEach(async () => {
    await removeTempDir(root);
  });

  async function writeFixture(
    relativePath: string,
    content: string,
  ): Promise<void> {
    const target = join(root, relativePath);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, content, "utf8");
  }

  it("reads a UTF-8 text file at a relative path", async () => {
    await writeFixture("sub/notes.txt", "café\nline two");

    const tool = new ReadFileTool(root);

    const result = await tool.execute({ path: "sub/notes.txt" });

    expect(result).toBe("café\nline two");
  });

  it("rejects a missing file", async () => {
    const tool = new ReadFileTool(root);

    await expect(tool.execute({ path: "missing.txt" })).rejects.toThrow(
      /File not found/,
    );
  });

  it("rejects a directory path", async () => {
    await mkdir(join(root, "adir"));

    const tool = new ReadFileTool(root);

    await expect(tool.execute({ path: "adir" })).rejects.toThrow(
      /directory, not a file/,
    );
  });

  it("rejects an empty path at the schema level", () => {
    expect(() => readFileInputSchema.parse({ path: "" })).toThrow();
  });

  it("rejects absolute paths", async () => {
    const tool = new ReadFileTool(root);

    await expect(tool.execute({ path: "/etc/hosts" })).rejects.toThrow(
      /Absolute paths are not allowed/,
    );
  });

  it("rejects paths that escape the working directory", async () => {
    const sandbox = await createTempDir();

    try {
      const workspace = join(sandbox, "workspace");
      await mkdir(workspace);
      await writeFile(join(sandbox, "secret.txt"), "top secret", "utf8");

      const tool = new ReadFileTool(workspace);

      await expect(
        tool.execute({ path: "../secret.txt" }),
      ).rejects.toThrow(/escapes the working directory/);

      await expect(
        tool.execute({ path: join("a", "..", "..", "secret.txt") }),
      ).rejects.toThrow(/escapes the working directory/);
    } finally {
      await removeTempDir(sandbox);
    }
  });

  it("refuses to follow a symlink pointing outside the working directory", async () => {
    const sandbox = await createTempDir();

    try {
      const workspace = join(sandbox, "workspace");
      await mkdir(workspace);
      await writeFile(join(sandbox, "outside.txt"), "outside", "utf8");
      await symlink(join(sandbox, "outside.txt"), join(workspace, "link.txt"));

      const tool = new ReadFileTool(workspace);

      await expect(tool.execute({ path: "link.txt" })).rejects.toThrow(
        /escapes the working directory/,
      );
    } finally {
      await removeTempDir(sandbox);
    }
  });

  it("follows a symlink that stays inside the working directory", async () => {
    await writeFixture("real.txt", "inside");
    await symlink(join(root, "real.txt"), join(root, "link.txt"));

    const tool = new ReadFileTool(root);

    await expect(tool.execute({ path: "link.txt" })).resolves.toBe("inside");
  });
});
