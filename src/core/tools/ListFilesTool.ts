import { readdir } from "node:fs/promises";
import { z } from "zod";
import type { Tool } from "../Tool.js";

export const listFilesInputSchema = z.object({
  path: z.string().min(1),
});

export type ListFilesInput = z.infer<typeof listFilesInputSchema>;

export class ListFilesTool
  implements Tool<ListFilesInput, string[]>
{
  name = "list_files";

  description = "List files and directories at a given path.";

  inputSchema = listFilesInputSchema;

  async execute(input: ListFilesInput): Promise<string[]> {
    return await readdir(input.path);
  }
}