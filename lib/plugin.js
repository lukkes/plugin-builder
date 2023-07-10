const plugin = {
  //----------------------------------------------------------------------
  _constants: {
    defaultRepo: "Default GitHub repo",
    requestTimeoutSeconds: 30,
  },

  //----------------------------------------------------------------------
  noteOption: {
    "Sync plugin": async function (app, noteUUID) {
      const note = await app.notes.find(noteUUID);
      const content = await note.content();
      let repoUrl = content.match(/repo:\s*(.*)/i)?.at(1);
      repoUrl = (repoUrl || app.settings[this._constants.defaultRepo]);
      if (!repoUrl) {
        repoUrl = await app.prompt("What repo to sync?");
        if (!repoUrl) {
          app.alert("Could not find a repo URL specified in settings or in note being synced. Please specify 'repo: https://github.com/your/path' in the note to sync")
          return;
        }
      }
      const fileNameArray = this._fileListFromRepoUrl(repoUrl);
      let codeBody = {};
      if (fileNameArray) {
        const jsFiles = fileNameArray.filter(path => /.*\.js/.test(path) && !/.*\.test\.js/.test(path));
        const jsBodies = jsFiles.map(async path => {
          console.log("Fetching", repoUrl, path);
          const body = await this._fetch(`${ repoUrl }/${ path }`);
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
        });
      }
    }
  },

  //----------------------------------------------------------------------
  async _noteInsertRange(note) {

  },

  //----------------------------------------------------------------------
  async _fileListFromRepoUrl(repoUrl) {
    const repoBody = await this._fetch(repoUrl);
    const fileMatches = repoBody.match(/path=.*/);
  },

  //----------------------------------------------------------------------
  async _fetch(url) {
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
        error = e;
        console.log(`Attempt ${ i + 1 } failed with`, e, `at ${ new Date() }. Retrying...`);
      }
    }
  }
}
export default plugin;
