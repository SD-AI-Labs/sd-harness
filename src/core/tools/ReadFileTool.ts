import { readFile, stat } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "../Tool.js";
import { resolveSafePath } from "./pathSecurity.js";

export const readFileInputSchema = z.object({
  path: z.string().min(1),
});

export type ReadFileInput = z.infer<typeof readFileInputSchema>;

/**
 * Read a UTF-8 text file from inside the working directory.
 */
export class ReadFileTool implements Tool<ReadFileInput, string> {
  name = "read_file";

  description =
    "Read a UTF-8 text file. Paths are relative to the working directory.";

  inputSchema = readFileInputSchema;

  constructor(
    private readonly workingDirectory: string = process.cwd(),
  ) {}

  async execute(input: ReadFileInput): Promise<string> {
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

    try {
      return await readFile(target, "utf8");
    } catch (error) {
      throw new Error(
        `Cannot read "${input.path}": ${(error as Error).message}`,
      );
    }
  }
}
