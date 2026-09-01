import type { AgentEvent } from "./AgentEvent.js";
import type { AgentObserver } from "./AgentObserver.js";

import type { AgentTrace } from "./AgentTrace.js";


export class TraceAgentObserver
  implements AgentObserver {

  private readonly events: AgentEvent[] =
    [];


  onEvent(
    event: AgentEvent,
  ): void {

    this.events.push(
      event,
    );
  }


  getTrace(): AgentTrace {

    return {
      events: [
        ...this.events,
      ],
    };
  }


  clear(): void {

    this.events.length = 0;
  }
}