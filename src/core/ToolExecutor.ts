import type { Tool } from "./Tool.js";


export class ToolExecutor {

  async execute(
    tool: Tool,
    input: unknown,
    timeoutMs: number,
  ): Promise<unknown> {

    return await Promise.race([
      tool.execute(input),

      new Promise((_, reject) =>
        setTimeout(
          () =>
            reject(
              new Error(
                `Tool timeout: ${tool.name}`
              )
            ),
          timeoutMs,
        )
      ),
    ]);
  }
}