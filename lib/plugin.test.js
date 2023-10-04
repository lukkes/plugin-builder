import { jest } from "@jest/globals"
import { mockApp, mockPlugin, mockNote } from "./test-helpers.js"

const REPO_URL = "https://github.com/alloy-org/plugin-builder";
// --------------------------------------------------------------------------------------
describe("This here plugin", () => {
  const plugin = mockPlugin();
  plugin._testEnvironment = true;

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
    await plugin.insertText["Refresh"].run(app);
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
    expect(plugin.noteOption["Refresh"].check(app)).toBeTruthy();
    expect(pluginNoteUUID).toEqual(app.context.noteUUID);
    expect(app.notes.find(app.context.noteUUID)).toEqual(note);
    expect(note.content()).toBeTruthy();
    const repoUrl = await plugin.insertText["Sync"].check(app);
    expect(repoUrl).toEqual(repoUrl);

    await plugin.insertText["Sync"].run(app);
    expect(note.body).toContain("async _inlined_plugin_import_inliner_js_fileContentFromUrl");
  });

  it("should allow specifying a custom entry file", async () => {
    const content = `Entry: ${ REPO_URL }/src/entry-test.js
    # Code block`.replace(/^[\s]*/gm, "");

    const note = mockNote(content, "Baby's plugin", "abc123");
    const app = mockApp(note);
    expect(plugin.noteOption["Refresh"].check(app)).toBeTruthy();
    await plugin.noteOption["Refresh"].run(app);
    const noteContent = note.content();
    console.log("Got content", noteContent);
    expect(noteContent).toContain("async _inlined_nested_import_js_wrappedFetch(");
    expect(noteContent).toContain("async _inlined_plugin_import_inliner_js_fetchWithRetry(");
    expect(noteContent.match(/async\s_inlined_plugin_import_inliner_js_fetchWithRetry\(/g).length).toEqual(1);
    expect(noteContent).toContain("async _inlined_plugin_import_inliner_js_fileContentFromUrl(");
  });

  it("should allow importing fancy-function content", async () => {
    const content = `Entry: ${ REPO_URL }/src/entry-test.js
    # Code block\n`.replace(/^[\s]*/gm, "");
    const note = mockNote(content, "Baby's plugin", "abc123");
    const app = mockApp(note);
    expect(plugin.noteOption["Refresh"].check(app)).toBeTruthy();
    await plugin.noteOption["Refresh"].run(app);
    const noteContent = note.content();
    console.log("Got content", noteContent);
    expect(app.notes.find(app.context.noteUUID)).toEqual(note);
    expect(note.content()).toBeTruthy();

    expect(note.body).toContain("*_inlined_fancy_function_test_js_generator");
    expect(note.body).not.toMatch(/^\s+};,\s*\n/gm);
  });
});
