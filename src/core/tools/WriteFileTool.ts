import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { z } from "zod";
import type { Tool } from "../Tool.js";
import { resolveSafePath } from "./pathSecurity.js";

export const writeFileInputSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
});

export type WriteFileInput = z.infer<typeof writeFileInputSchema>;

export interface WriteFileResult {
  /** The path as supplied by the caller. */
  path: string;
  /** Number of UTF-8 bytes written. */
  bytesWritten: number;
}

/**
 * Create or overwrite a text file inside the working directory.
 */
export class WriteFileTool
  implements Tool<WriteFileInput, WriteFileResult>
{
  name = "write_file";

  description =
    "Create or overwrite a text file. Paths are relative to the working directory.";

  inputSchema = writeFileInputSchema;

  constructor(
    private readonly workingDirectory: string = process.cwd(),
  ) {}

  async execute(input: WriteFileInput): Promise<WriteFileResult> {
    const target = await resolveSafePath(
      this.workingDirectory,
      input.path,
    );

    try {
      await mkdir(dirname(target), { recursive: true });
      await writeFile(target, input.content, "utf8");
    } catch (error) {
      throw new Error(
        `Cannot write "${input.path}": ${(error as Error).message}`,
      );
    }

    return {
      path: input.path,
      bytesWritten: Buffer.byteLength(input.content, "utf8"),
    };
  }
}
