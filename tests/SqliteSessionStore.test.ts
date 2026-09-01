import { describe, expect, it } from "vitest";
import { SqliteSessionStore } from "../src/memory/SqliteSessionStore.js";


describe("SqliteSessionStore", () => {


  it("saves and loads session", () => {

    const store =
      new SqliteSessionStore();


    const context = {
      sessionId: "test-session",
      messages: [
        {
          role:"user" as const,
          content:"hello"
        }
      ]
    };


    store.save(context);


    const loaded =
      store.load(
        "test-session"
      );


    expect(
      loaded?.messages[0].content
    )
    .toBe("hello");

  });

});