import type { AgentObserver } from "./AgentObserver.js";
import type { AgentEvent } from "./AgentEvent.js";


export class ConsoleAgentObserver
  implements AgentObserver {

  onEvent(event: AgentEvent): void {

    console.log(
      `[${event.type}]`,
      event.data ?? ""
    );

  }

}