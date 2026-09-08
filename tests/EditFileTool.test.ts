import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { EditFileTool } from "../src/core/tools/EditFileTool.js";
import { editFileInputSchema } from "../src/core/tools/EditFileTool.js";

import { createTempDir, removeTempDir } from "./toolTestUtils.js";

describe("EditFileTool", () => {
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

  it("replaces unique text in a file", async () => {
    await writeFixture("lines.txt", "line one\nline two\n");

    const tool = new EditFileTool(root);

    const result = await tool.execute({
      path: "lines.txt",
      oldText: "line one",
      newText: "first line",
    });

    expect(result).toEqual({ path: "lines.txt", replacements: 1 });
    expect(await readFile(join(root, "lines.txt"), "utf8")).toBe(
      "first line\nline two\n",
    );
  });

  it("fails when the old text is missing", async () => {
    await writeFixture("lines.txt", "abc");

    const tool = new EditFileTool(root);

    await expect(
      tool.execute({
        path: "lines.txt",
        oldText: "zzz",
        newText: "xxx",
      }),
    ).rejects.toThrow(/Expected text not found/);

    // The file must be left untouched.
    expect(await readFile(join(root, "lines.txt"), "utf8")).toBe("abc");
  });

  it("fails when the old text is ambiguous", async () => {
    await writeFixture("lines.txt", "foo bar foo baz");

    const tool = new EditFileTool(root);

    await expect(
      tool.execute({
        path: "lines.txt",
        oldText: "foo",
        newText: "bar",
      }),
    ).rejects.toThrow(/ambiguous: found 2 occurrences/);

    expect(await readFile(join(root, "lines.txt"), "utf8")).toBe(
      "foo bar foo baz",
    );
  });

  it("removes text when the replacement is empty", async () => {
    await writeFixture("lines.txt", "delete me\nkeep me");

    const tool = new EditFileTool(root);

    await tool.execute({
      path: "lines.txt",
      oldText: "delete me\n",
      newText: "",
    });

    expect(await readFile(join(root, "lines.txt"), "utf8")).toBe("keep me");
  });

  it("fails when the file does not exist", async () => {
    const tool = new EditFileTool(root);

    await expect(
      tool.execute({
        path: "missing.txt",
        oldText: "x",
        newText: "y",
      }),
    ).rejects.toThrow(/File not found/);
  });

  it("rejects an empty old text at the schema level", () => {
    expect(() =>
      editFileInputSchema.parse({ path: "a.txt", oldText: "", newText: "x" }),
    ).toThrow();
  });

  it("rejects absolute paths", async () => {
    const tool = new EditFileTool(root);

    await expect(
      tool.execute({
        path: "/etc/hosts",
        oldText: "x",
        newText: "y",
      }),
    ).rejects.toThrow(/Absolute paths are not allowed/);
  });

  it("rejects paths that escape the working directory", async () => {
    const sandbox = await createTempDir();

    try {
      const workspace = join(sandbox, "workspace");
      await mkdir(workspace);
      await writeFile(join(sandbox, "secret.txt"), "abc", "utf8");

      const tool = new EditFileTool(workspace);

      await expect(
        tool.execute({
          path: "../secret.txt",
          oldText: "abc",
          newText: "def",
        }),
      ).rejects.toThrow(/escapes the working directory/);

      expect(await readFile(join(sandbox, "secret.txt"), "utf8")).toBe("abc");
    } finally {
      await removeTempDir(sandbox);
    }
  });
});
