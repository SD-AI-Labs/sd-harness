import type { ZodType } from "zod";

export interface Tool<TInput = unknown, TOutput = unknown> {
  name: string;
  description: string;
  inputSchema: ZodType<TInput>;

  execute(input: TInput): Promise<TOutput>;
}