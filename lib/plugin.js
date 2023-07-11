import { inlineImportsFromGithub, pluginFetch } from "./plugin-file-extractor"

const plugin = {
  //----------------------------------------------------------------------
  _constants: {
    defaultBranch: "main",
    entryLocations: [ "lib/plugin.js", "plugin.js", "index.js" ],
    maxReplaceContentLength: 100000,
  },

  //----------------------------------------------------------------------
  insertText: {
    "Plugin sync": {
      check: async function(app) {
        return !!(await this._githubRepoUrl(app));
      },
      run: async function(app) {
        const githubUrl = await this._githubRepoUrl(app);
        if (githubUrl) {
          await this._syncUrlToNote(app, githubUrl);
        } else {
          throw new Error("Could not ascertain githubUrl");
        }
      }
    }
  },

  //----------------------------------------------------------------------
  noteOption: {
    "Plugin sync": {
      check: async function(app) {
        return await this._githubRepoUrl(app);
      },
      run: async function(app) {
        const repoUrl = await this._githubRepoUrl(app)
        await this._syncUrlToNote(app, repoUrl);
      }
    }
  },

  //----------------------------------------------------------------------
  async _syncUrlToNote(app, repoUrl) {
    const entryPoint = await this._entryPointFromUrl(app, repoUrl);
    if (entryPoint.url) {
      const note = await app.notes.find(app.context.noteUUID);
      let noteContent = await note.content();
      let noteInsertExtents = await this._noteInsertRange(noteContent);
      if (!noteInsertExtents) {
        console.error("Could not find a code block to replace in note", noteContent, "Appending one anew.");
        noteInsertExtents = [ noteContent.length - 1, noteContent.length - 1 ];
      }
      console.log("Will replace content between ", noteInsertExtents[0], " and ", noteInsertExtents[1], " currently:", noteContent.substring(noteInsertExtents[0], noteInsertExtents[1]));
      if (!entryPoint.content) {
        console.error("Could not find a valid entry point in repo", repoUrl, "at", entryPoint.url);
        return null;
      }
      const mainPluginBlock = entryPoint.content.match(/.*(\{\n[\S\s]*\n\})/)?.at(1);
      const newPluginBlock = await inlineImportsFromGithub(entryPoint, mainPluginBlock);
      if (newPluginBlock) {
        if (newPluginBlock.length > this._constants.maxReplaceContentLength) {
          app.alert(`The code block (length ${ newPluginBlock.length }) is too long to replace (max size ${ this._constants.maxReplaceContentLength }).` +
            `Please manually replace the code block in the note, or email support@amplenote.com to request an increase in the size of replaceContent.`)
        } else {
          noteContent = noteContent.substring(0, noteInsertExtents[0]);
          noteContent += `\`\`\`\n// Javascript inserted by Amplenote Plugin Builder () from source code at ${ repoUrl }\n${ newPluginBlock }\n\`\`\``;
          noteContent += noteContent.substring(noteInsertExtents[1]);
          await note.replaceContent(noteContent);
          console.info("Content successfully updated with new code block", newPluginBlock);
        }
      } else {
        app.alert("Could not construct a code block from the entry point URL. Please check the console for more details.")
        return null;
      }
    }
  },

  //----------------------------------------------------------------------
  async _githubRepoUrl(app) {
    const noteContent = await app.getNoteContent({ uuid: app.context.noteUUID });
    const urlRegex = /^\s*(entry|repo)\s*[=:]\s*(https:\/\/github.com\/)?(?<organizationSlug>[\w\-_.]+)\/(?<repoSlug>[\w\-_.]+)(?<entryFile>\/[\w\-_.]+\.(ts|js))?(?:$|\n|\r)/im;
    const match = noteContent.match(urlRegex);
    if (match?.groups?.organizationSlug && match?.groups?.repoSlug) {
      return `https://github.com/${ match.groups.organizationSlug }/${ match.groups.repoSlug }${ match.groups.entryFile ? match.groups.entryFile : "" }`

    } else {
      await app.alert("Could not find a repo URL in the note. Please include a line that begins with 'repo:' and has the URL of repo to sync");
      return null;
    }
  },

  //----------------------------------------------------------------------
  /** Details about the entry point for this repo
   * @param {string} app
   * @param {string} repoOrFileUrl - URL to a Github repo or a file in a Github repo
   * @returns {object} - { content: string, url: string }
   */
  async _entryPointFromUrl(app, repoOrFileUrl) {
    if (!repoOrFileUrl) {
      throw new Error("Missing repoUrl");
    }

    let content, url;
    if (/\.(js|ts)$/.test(repoOrFileUrl)) {
      let path = repoOrFileUrl.replace("https://github.com/", "");
      const components = path.split("/");
      if (components.length >= 3) {
        url = `https://github.com/${ components[0] }/${ components[1] }/raw/${ this._constants.defaultBranch }/${ components.slice(2).join("/") }`;
        const response = await pluginFetch(url);
        if (response.ok) {
          content = await response.text();
        } else {
          url = null;
          app.alert(`Could not find a valid Github file at the entry point URL "${ url }" (derived from "${ repoOrFileUrl }")`);
        }
      } else {
        // Perhaps the user is using a non-standard branch name? We might want to make that configurable?
        app.alert(`Could not parse a valid Github file at "${ repoOrFileUrl }"`);
      }
    } else {
      for (const entryLocation of this._constants.entryLocations) {
        url = `${ repoOrFileUrl }/raw/${ this._constants.defaultBranch }/${ entryLocation }`;
        const rawResponse = await pluginFetch(url);
        if (rawResponse.ok) {
          content = await rawResponse.text();
          break;
        } else {
          url = null;
        }
      }
    }

    return { content, url };
  },

  //----------------------------------------------------------------------
  /** Recursively collect file contents to compose a block that can be inserted into note
   * @param {string} body Contents of a plugin note file containing a code block
   * @returns {array|null} - [ startMatchIndex, endMatchIndex ]
   */
  async _noteInsertRange(body) {
    const matches = Array.from(body.matchAll(/^```[\w]*(?:[\n\r]|$)/gm));
    if (!matches || matches.length < 2) {
      return null;
    }
    const firstMatch = matches[0];
    const startMatchIndex = firstMatch ? firstMatch.index + firstMatch[0].length : null;
    const endMatchIndex = matches[1] ? matches[1].index : null;
    if (Number.isInteger(startMatchIndex) && Number.isInteger(endMatchIndex)) {
      return [ startMatchIndex, endMatchIndex ];
    } else {
      return null;
    }
  }

}
export default plugin;
