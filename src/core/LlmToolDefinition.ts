export interface LlmToolDefinition {
  type: "function";

  function: {
    name: string;
    description: string;
    parameters: object;
  };
}