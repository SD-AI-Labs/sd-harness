import { describe, expect, it } from "vitest";
import { ListFilesTool } from "../src/core/tools/ListFilesTool.js";
import { ToolSchemaConverter } from "../src/core/ToolSchemaConverter.js";

describe("ToolSchemaConverter", () => {
  it("converts tool to LLM definition", () => {
    const tool = new ListFilesTool();

    const definition =
      ToolSchemaConverter.convert(tool);

    expect(definition.function.name)
      .toBe("list_files");

    expect(definition.function.parameters)
      .toBeDefined();
  });
});