import { describe, expect, it } from "vitest";
import { ListFilesTool } from "../src/core/tools/ListFilesTool.js";

describe("ListFilesTool", () => {
  it("lists files in a directory", async () => {
    const tool = new ListFilesTool();

    const result = await tool.execute({
      path: ".",
    });

    expect(result).toContain("package.json");
  });
});

it("rejects invalid input", () => {
  const tool = new ListFilesTool();

  expect(() =>
    tool.inputSchema.parse({
      path: "",
    }),
  ).toThrow();
});