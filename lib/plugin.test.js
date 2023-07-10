import { jest } from "@jest/globals"
import { mockApp, mockPlugin, mockNote } from "./test-helpers.js"

import plugin from "./plugin.js"

// --------------------------------------------------------------------------------------
describe("plugin", () => {
  const plugin = mockPlugin();
  plugin._testEnvironment = true;

  // --------------------------------------------------------------------------------------
  describe("with code", () => {
    // --------------------------------------------------------------------------------------
    it("should propagate repo to note", async () => {

    });
  });
});
