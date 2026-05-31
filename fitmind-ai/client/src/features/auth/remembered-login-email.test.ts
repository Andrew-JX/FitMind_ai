import { afterEach, describe, expect, it, vi } from "vitest";

import {
  getRememberedLoginEmail,
  saveRememberedLoginEmail,
} from "./remembered-login-email";

describe("remembered login email", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stores only the email convenience value", () => {
    vi.stubGlobal("window", { localStorage: createMemoryStorage() });

    saveRememberedLoginEmail(" user@example.com ");

    expect(getRememberedLoginEmail()).toBe("user@example.com");
    expect(window.localStorage.length).toBe(1);
  });

  it("clears the stored email when the user opts out", () => {
    vi.stubGlobal("window", { localStorage: createMemoryStorage() });

    saveRememberedLoginEmail("user@example.com");
    saveRememberedLoginEmail("");

    expect(getRememberedLoginEmail()).toBe("");
    expect(window.localStorage.length).toBe(0);
  });
});

function createMemoryStorage(): Storage {
  const values = new Map<string, string>();

  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}
