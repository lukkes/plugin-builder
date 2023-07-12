import { jest } from "@jest/globals"
import { mockApp, mockPlugin, mockNote } from "./test-helpers.js"

const REPO_URL = "https://github.com/alloy-org/plugin-builder";
// --------------------------------------------------------------------------------------
describe("plugin", () => {
  const plugin = mockPlugin();
  plugin._testEnvironment = true;

  // --------------------------------------------------------------------------------------
  describe("with code", () => {
    // --------------------------------------------------------------------------------------
    it("should fail when there is nowhere to insert code", async () => {
      const content = `Baby's plugin
      Repo: ${ REPO_URL }
      |  |  |
      | ---- | ----------- |
      | name | Baby's plugin | 
      
      \`\`\`javascript
      {
        name: "Baby's"
      }
      \`\`\`
    `.replace(/^[\s]*/gm, "");

      const pluginNoteUUID = "abc123";
      const note = mockNote(content, "Baby's plugin", pluginNoteUUID);
      const app = mockApp(note);
      app.alert = jest.fn();
      await plugin.insertText["Plugin sync"].run(app);
      expect(app.alert).toHaveBeenCalledWith(plugin._noSyncMessage());
    });

    // --------------------------------------------------------------------------------------
    it("should propagate repo to note", async () => {
      const content = `Baby's plugin
      Repo: ${ REPO_URL }
      |  |  |
      | ---- | ----------- |
      | name | Baby's plugin | 
      
    `.replace(/^[\s]*/gm, "");

      const pluginNoteUUID = "abc123";
      const note = mockNote(content, "Baby's plugin", pluginNoteUUID);
      const app = mockApp(note);
      expect(pluginNoteUUID).toEqual(app.context.noteUUID);
      expect(app.notes.find(app.context.noteUUID)).toEqual(note);
      expect(note.content()).toBeTruthy();
      const repoUrl = plugin.insertText["Plugin sync"].check(app);
      expect(repoUrl).toEqual(repoUrl);

      await plugin.insertText["Plugin sync"].run(app);
      expect(note.body).toContain("async _inlined_fileContentFromUrl");
    });
  });
});
