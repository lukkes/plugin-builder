import { jest } from "@jest/globals"
import { mockApp, mockPlugin, mockNote } from "./test-helpers.js"

import plugin from "./plugin.js"

// --------------------------------------------------------------------------------------
describe("plugin", () => {
  const plugin = mockPlugin();
  plugin._testEnvironment = true;

  // --------------------------------------------------------------------------------------
  describe("with code", () => {
    const repoUrl = "https://github.com/alloy-org/plugin-builder";
    const content = `Baby's plugin
      Repo: ${ repoUrl }
      |  |  |
      | ---- | ----------- |
      | name | Baby's plugin | 
      
      \`\`\`javascript
      {
        name: "Baby's"
      }
      \`\`\`
    `.replace(/^[\s]*/gm, "");

    const githubRequest = jest.fn();
    githubRequest.mockImplementation((url, retries = 2) => {
      const stringUrl = String(url);
      if (stringUrl.includes(repoUrl)) {
        return { count: 0, next: null, previous: null, results: [] };
      } else {
        throw new Error(`Unexpected URL: ${ url }`);
      }
    });
    // plugin._fetch = githubRequest;

    const pluginFileContent = `const plugin = {\n  _constants: {\n    name: "Pony boy",\n  }\n}\n`;

    const pluginNoteUUID = "abc123";
    const note = mockNote(content, "Baby's plugin", pluginNoteUUID);
    const app = mockApp(note);

    // --------------------------------------------------------------------------------------
    it("should propagate repo to note", async () => {
      expect(pluginNoteUUID).toEqual(app.context.noteUUID);
      expect(app.notes.find(app.context.noteUUID)).toEqual(note);
      expect(note.content()).toBeTruthy();
      const repoUrl = plugin.insertText["Plugin sync"].check(app);
      expect(repoUrl).toEqual(repoUrl);

      await plugin.insertText["Plugin sync"].run(app);
      const container = document.createElement("div");
      expect(container).toBeTruthy();
      container.innerHTML = note.body;
      const codeBlock = container.querySelector("pre");
      expect(codeBlock).toEqual(pluginFileContent);
    });
  });
});
