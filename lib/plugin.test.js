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
    `;

    const githubRequest = jest.fn();
    githubRequest.mockImplementation((app, url) => {
      const stringUrl = String(url);
      if (stringUrl.includes(repoUrl)) {
        if (!stringUrl.includes("page=") || stringUrl.includes("page=1")) {
          return { count: 1, next: null, previous: null, results: [ readwiseBook1 ] };
        } else {
          return { count: 0, next: null, previous: null, results: [] };
        }
      } else {
        throw new Error(`Unexpected URL: ${ url }`);
      }
    });
    plugin._readwiseMakeRequest = readwiseBookListRequest;
    plugin._readwiseFetchBooks = getBook.bind(plugin);

    const pluginFileContent = `const plugin = {\n  _constants: {\n    name: "Pony boy",\n  }\n}\n`;

    const pluginNoteUUID = "abc123";
    const note = mockNote(content, "Baby's plugin", pluginNoteUUID);
    const app = mockApp(note);

    // --------------------------------------------------------------------------------------
    it("should propagate repo to note", async () => {
      const repoUrl = plugin.insertText["Plugin sync"].check(app);
      expect(repoUrl).toEqual(repoUrl);

      await plugin.insertText["Plugin sync"].run(app);
      const container = document.createElement("div");
      expect(container).toBeTruthy();
      container.innerHTML = note.body;
      const codeBlock = container.querySelector("pre");
      expect(codeBlock).toEqual();
    });
  });
});
