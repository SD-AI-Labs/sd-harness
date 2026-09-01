import type { Message } from "../core/Message.js";


export interface ContextManager {

  prepare(
    messages: Message[]
  ): Message[];

}