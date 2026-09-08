import { readFile, stat, writeFile } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "../Tool.js";
import { resolveSafePath } from "./pathSecurity.js";

export const editFileInputSchema = z.object({
  path: z.string().min(1),
  oldText: z.string().min(1),
  newText: z.string(),
});

export type EditFileInput = z.infer<typeof editFileInputSchema>;

export interface EditFileResult {
  /** The path as supplied by the caller. */
  path: string;
  /** Number of replacements made (always 1 for a successful edit). */
  replacements: number;
}

/**
 * Replace a unique block of text in a file inside the working directory.
 */
export class EditFileTool
  implements Tool<EditFileInput, EditFileResult>
{
  name = "edit_file";

  description =
    "Replace text in a file. The old text must match exactly once. Paths are relative to the working directory.";

  inputSchema = editFileInputSchema;

  constructor(
    private readonly workingDirectory: string = process.cwd(),
  ) {}

  async execute(input: EditFileInput): Promise<EditFileResult> {
    const target = await resolveSafePath(
      this.workingDirectory,
      input.path,
    );

    const stats = await stat(target).catch(
      (error: NodeJS.ErrnoException) => {
        if (error.code === "ENOENT") {
          throw new Error(`File not found: "${input.path}"`);
        }
        throw new Error(
          `Cannot access "${input.path}": ${error.message}`,
        );
      },
    );

    if (stats.isDirectory()) {
      throw new Error(`Path is a directory, not a file: "${input.path}"`);
    }

    let content: string;

    try {
      content = await readFile(target, "utf8");
    } catch (error) {
      throw new Error(
        `Cannot read "${input.path}": ${(error as Error).message}`,
      );
    }

    const occurrences = content.split(input.oldText).length - 1;

    if (occurrences === 0) {
      const snippet =
        input.oldText.length <= 60
          ? JSON.stringify(input.oldText)
          : JSON.stringify(input.oldText.slice(0, 57) + "...");

      throw new Error(
        `Expected text not found in "${input.path}": ${snippet}`,
      );
    }

    if (occurrences > 1) {
      throw new Error(
        `Expected text is ambiguous: found ${occurrences} occurrences in "${input.path}". The old text must match exactly once.`,
      );
    }

    const updated = content.replace(input.oldText, input.newText);

    try {
      await writeFile(target, updated, "utf8");
    } catch (error) {
      throw new Error(
        `Cannot write "${input.path}": ${(error as Error).message}`,
      );
    }

    return {
      path: input.path,
      replacements: 1,
    };
  }
}
