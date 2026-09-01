import type { SessionStore } from "./SessionStore.js";
import type { AgentContext } from "../core/AgentContext.js";
import { db } from "./database.js";


export class SqliteSessionStore
  implements SessionStore {


  save(
    context: AgentContext
  ): void {

    db.prepare(`
      INSERT OR REPLACE INTO sessions
      (
        id,
        data
      )
      VALUES
      (
        ?,
        ?
      )
    `)
    .run(
      context.sessionId,
      JSON.stringify(context),
    );
  }



  load(
    sessionId: string
  ): AgentContext | undefined {


    const row =
      db.prepare(`
        SELECT data
        FROM sessions
        WHERE id = ?
      `)
      .get(sessionId) as
      | { data: string }
      | undefined;


    if (!row) {
      return undefined;
    }


    return JSON.parse(
      row.data
    );
  }
}