import type { ContextManager } from "./ContextManager.js";
import type { Message } from "../core/Message.js";


export class SimpleContextManager
  implements ContextManager {


  constructor(
    private readonly maxMessages = 20
  ) {}


  prepare(
    messages: Message[]
  ): Message[] {

    if (
      messages.length <= this.maxMessages
    ) {
      return messages;
    }


    return messages.slice(
      messages.length - this.maxMessages
    );
  }
}