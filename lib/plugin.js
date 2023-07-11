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
        return await this._githubRepoUrl(app);
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
      const note = await app.notes.findNote(app.context.noteUUID);
      const noteContent = await note.content();
      const noteInsertRange = await this._noteInsertRange(noteContent);
    }
  },

  //----------------------------------------------------------------------
  async _githubRepoUrl(app) {
    const noteContent = await app.getNoteContent({ uuid: app.context.noteUUID });
    const urlRegex = /^\s*repo:\s*(https:\/\/github.com\/)?(?<organizationSlug>[\w\-_.]+)\/(?<repoSlug>[\w\-_.]+)(?:$|\n|\r)/im;
    const match = noteContent.match(urlRegex);
    if (match?.groups?.organizationSlug && match?.groups?.repoSlug) {
      return `https://github.com/${ match.groups.organizationSlug }/${ match.groups.repoSlug }`
    } else {
      return null;
    }
  },

  //----------------------------------------------------------------------
  async _filePageContentFromUrl(app, repoUrl) {
    let content;
    for (const entryLocation of this._constants.entryLocations) {
      const rawResponse = await this._fetch(`${ repoUrl }/raw/${ this._constants.defaultBranch }/${ entryLocation }`);
      if (rawResponse.ok) {
        content = await rawResponse.text();
        break;
      }
    }

    return content;
  },

  //----------------------------------------------------------------------
  async _noteInsertRange(body) {
    const startMatch = body.match(/({\s*$|^\{})/m);
    const startMatchIndex = startMatch?.index;
    const endMatch = body.match(/^}/m);
    const endMatchIndex = endMatch?.index;
    if (Number.isInteger(startMatchIndex) && Number.isInteger(lastMatchIndex)) {
      const code = body.substring(startMatchIndex, endMatchIndex);

      try {
        const object = eval(code);
        const codyBody = { ...codeBody, ...object };
      } catch(err) {
        console.error(err);
        await app.alert("There was an error evaluating the object:" + err);
      }
    }
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
