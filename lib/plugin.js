import fetch from "isomorphic-fetch"

const plugin = {
  //----------------------------------------------------------------------
  _constants: {
    defaultBranch: "main",
    entryLocations: [ "lib/plugin.js", "plugin.js", "index.js" ],
    requestTimeoutSeconds: 30,
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
    const content = await this._filePageContentFromUrl(app, repoUrl);
    if (content) {
      const note = await app.notes.find(app.context.noteUUID);
      const noteContent = await note.content();
      const noteInsertExtents = await this._noteInsertRange(noteContent);
      console.log("Will replace content between ", noteInsertExtents[0], " and ", noteInsertExtents[1], " currently:", noteContent.substring(noteInsertExtents[0], noteInsertExtents[1]));
      const newCodeBlock = await this._codeBlockFromGithub()
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
  async _filePageContentFromUrl(app, repoOrFileUrl) {
    if (!repoOrFileUrl) {
      throw new Error("Missing repoUrl");
    }

    let content;
    if (/\.(js|ts)$/.test(repoOrFileUrl)) {
      let path = repoOrFileUrl.replace("https://github.com/", "");
      const components = path.split("/");
      if (components.length >= 3) {
        const url = `https://github.com/${ components[0] }/${ components[1] }/raw/${ this._constants.defaultBranch }/${ components.slice(2).join("/") }`;
        const response = await this._fetch(url);
        if (response.ok) {
          content = await response.text();
        } else {
          app.alert(`Could not find a valid Github file at the entry point URL "${ url }" (derived from "${ repoOrFileUrl }")`);
        }
      } else {
        // Perhaps the user is using a non-standard branch name? We might want to make that configurable?
        app.alert(`Could not parse a valid Github file at "${ repoOrFileUrl }"`);
      }
    } else {
      for (const entryLocation of this._constants.entryLocations) {
        const rawResponse = await this._fetch(`${ repoOrFileUrl }/raw/${ this._constants.defaultBranch }/${ entryLocation }`);
        if (rawResponse.ok) {
          content = await rawResponse.text();
          break;
        }
      }
    }

    return content;
  },

  //----------------------------------------------------------------------
  async _noteInsertRange(body) {
    const matches = body.match(/^```[\w]*(?:[\n\r]|$)/g);
    if (matches < 2) return null;
    const startMatchIndex = matches[0] ? matches[0].index + matches[0].length : null;
    const endMatchIndex = matches[1] ? matches[1].index : null;
    if (Number.isInteger(startMatchIndex) && Number.isInteger(endMatchIndex)) {
      return [ startMatchIndex, endMatchIndex ];
    }
  },

  //----------------------------------------------------------------------
  async _codeBlockFromGithub(app) {

  },

  //----------------------------------------------------------------------
  async _fetch(url, retries = 2) {
    const timeoutSeconds = this._constants.requestTimeoutSeconds;
    let error, response;

    for (let i = 0; i < retries; i++) {
      try {
        return Promise.race([
          fetch(url, {
            method: "GET",
            headers: {
              // Could be used if GH repo is private
              // "Authorization": `Bearer ${ app.settings["API Key"] }`,
              "Content-Type": "text/plain",
            },
          }),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Timeout')), timeoutSeconds * 1000)
          )
        ]);
      } catch (e) {
        debugger;
        error = e;
        console.log(`Attempt ${ i + 1 } failed with`, e, `at ${ new Date() }. Retrying...`);
      }
    }
  }
}
export default plugin;
