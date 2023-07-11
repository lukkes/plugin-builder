const plugin = {
  //----------------------------------------------------------------------
  _constants: {
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
        await this._syncUrlToNote(app, githubUrl);
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
  async _githubRepoUrl(app) {
    const noteContent = await app.getNoteContent({ uuid: app.context.noteUUID });
    const match = noteContent.match(/^repo:\s*(https:\/\/github.com\/)?(?<organizationSlug>[\w]+)\/(?<repoSlug>[\w]+)(?:$|\n|\r)/im);
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
      const response = this._fetch(`${ repoUrl }/${ entryLocation }`);
    }
  },

  //----------------------------------------------------------------------
  async _syncUrlToNote(app, repoUrl) {
    const fileNameArray = this._fileListFromRepoUrl(repoUrl);
    let codeBody = {};
    if (fileNameArray) {
      const jsFiles = fileNameArray.filter(path => /.*\.js/.test(path) && !/.*\.test\.js/.test(path));
      const jsBodies = jsFiles.map(async path => {
        console.log("Fetching", repoUrl, path);
        const body = await this._fetch(`${ repoUrl }/${ path }`);

      });
    }
  },

  //----------------------------------------------------------------------
  async _noteInsertRange(note) {
    const body = note.body;
    const startMatch = body.match(/({\s*$|^\{}))/m);
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
  async _fileListFromRepoUrl(repoUrl) {
    const repoBody = await this._fetch(repoUrl);
    const fileMatches = repoBody.match(/path=.*/);
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
