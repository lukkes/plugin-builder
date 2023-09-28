import { fileContentFromUrl, inlineImports } from "./plugin-import-inliner.js";
import { promises as fs} from 'fs';

const plugin = {
  //----------------------------------------------------------------------
  _constants: {
    defaultBranch: "main",
    codeHeading: "Code block",
    entryLocations: [ "lib/plugin.js", "plugin.js", "index.js" ],
    maxReplaceContentLength: 100000,
  },

  //----------------------------------------------------------------------
  insertText: {
    "Refresh": {
      check: async function(app) {
        return !!(await this._githubRepoUrl(app, { quietFail: true }));
      },
      run: async function(app) {
        if (!app) {
          // If app is undefined or null, plugin was invoked locally via node
          console.log("Running offline...");
          const entryPoint = await this._entryPointFromFile(app, process.cwd());
          let result = await this._inlineRepoToFile(entryPoint, "offline");
          return result;
        }
        else {
          console.log("Running as a plugin...");
          const githubUrl = await this._githubRepoUrl(app);
          if (githubUrl) {
            const entryPoint = await this._entryPointFromUrl(app, githubUrl);
            const note = await app.notes.find(app.context.noteUUID);
            let noteContent = await note.content();
            if (!(await this._isAbleToSync(app, noteContent))) {
              return null;
            }

            let result = await this._inlineRepoToFile(entryPoint, "github");
            if (result && result.length > this._constants.maxReplaceContentLength) {
              app.alert(`The code block (length ${ result.length }) is too long to replace (max size ${ this._constants.maxReplaceContentLength }).` +
                `Please manually replace the code block in the note, or email support@amplenote.com to request an increase in the size of replaceContent.`);
            } else {
              result = `\`\`\`\n// Javascript updated ${ (new Date()).toLocaleString() } by Amplenote Plugin Builder from source code within "${ githubUrl }"\n${ result }\n\`\`\``;
              const replaceTarget = this._sectionFromHeadingText(this._constants.codeHeading);
              await note.replaceContent(result, replaceTarget);
              await app.alert(`🎉 Plugin refresh from "${ githubUrl }" succeeded at ${ (new Date()).toLocaleString() }`);
            }
            } else {
              app.alert(`Could not find a line beginning in "repo:" or "entry:" in the note.`);
            }
        }
      }
    },
    "Sync": {
      check: async function(app) {
        const boundCheck = this.insertText["Refresh"].check.bind(this);
        return await boundCheck(app);
      },
      run: async function(app) {
        const boundRun = this.insertText["Refresh"].run.bind(this);
        return await boundRun(app);
      }
    }
  },

  //----------------------------------------------------------------------
  noteOption: {
    "Refresh": {
      check: async function(app) {
        const boundCheck = this.insertText["Refresh"].check.bind(this);
        return await boundCheck(app);
      },
      run: async function(app) {
        const boundRun = this.insertText["Refresh"].run.bind(this);
        return await boundRun(app);
      }
    }
  },

  //----------------------------------------------------------------------
  async _inlineRepoToFile(entryPoint, source) {
    if (entryPoint.url) {
      if (!entryPoint.content) {
        console.error("Could not find a valid entry point in repo at", entryPoint.url);
        return null;
      }
      const mainPluginBlock = entryPoint.content.match(/.*(\{\n[\S\s]*\n\})/)?.at(1);
      const functionTranslations = [];
      let newPluginBlock = await inlineImports(entryPoint, mainPluginBlock, functionTranslations, source);
      if (newPluginBlock) {
        return newPluginBlock;
      } else {
        console.log("Could not construct a code block from the entry point URL. There may be more details in the console.");
        return null;
      }
    }
  },

  //----------------------------------------------------------------------
  _sectionFromHeadingText(headingText, { level = 1 } = {}) {
    return { section: { heading: { text: headingText, level }}};
  },

  //----------------------------------------------------------------------
  async _isAbleToSync(app, noteContent) {
    if (noteContent.includes(this._constants.codeHeading)) {
      return true;
    } else {
      if (/^```/m.test(noteContent)) {
        await app.alert(this._noSyncMessage());
        return false;
      } else {
        console.log("Adding code block heading to note");
        const note = await app.notes.find(app.context.noteUUID);
        await note.insertContent(`\n\n# ${ this._constants.codeHeading }\n\n`, { atEnd: true });
        return true;
      }
    }
  },

  //----------------------------------------------------------------------
  _noSyncMessage() {
    return `Could not sync plugin because the note already contains code but no code block heading. Please add ` +
      `an h1 heading labeled "${ this._constants.codeHeading }" above your code block and try again.\n\nOr you can just delete` +
      `the code block and run the plugin again to re-create it with a heading.`;
  },

  //----------------------------------------------------------------------
  async _githubRepoUrl(app, { quietFail = false } = {}) {
    const noteContent = await app.getNoteContent({ uuid: app.context.noteUUID });
    const urlRegex = /^\s*(entry|repo)\s*[=:]\s*(https:\/\/github.com\/)?(?<organizationSlug>[\w\-_.]+)\/(?<repoSlug>[\w\-_.]+)\/?(?<entryFile>[\w\-_.\/]+\.(ts|js))?(?:$|\n|\r)/im;
    const match = noteContent.match(urlRegex);
    if (match?.groups?.organizationSlug && match?.groups?.repoSlug) {
      return `https://github.com/${ match.groups.organizationSlug }/${ match.groups.repoSlug }${ match.groups.entryFile ? `/${ match.groups.entryFile }` : "" }`;

    } else {
      if (!quietFail) {
        await app.alert("Could not find a repo URL in the note. Please include a line that begins with 'repo:' and has the URL of repo to sync");
      }
      return null;
    }
  },

  //----------------------------------------------------------------------
  /** Details about the entry point for this repo
   * @param {string} app
   * @param {string} repoOrFileUrl - URL to a Github repo or a file in a Github repo
   * @returns {object} - { content: string, url: string }
   */
  async _getEntryPoint({urlBase, alertMessage, filePath=false}) {
    let content, url;
    const tryReadFile = async (path) => {
      try {
        return await (filePath ? fs.readFile(path, 'utf-8') : fileContentFromUrl(path));
      } catch (error) {
        return null;
      }
    };

    if (/\.(js|ts)$/.test(urlBase)) {
      content = await tryReadFile(urlBase);
      url = urlBase;
    } else {
      for (const entryLocation of this._constants.entryLocations) {
        const potentialPath = filePath ? `${urlBase}/${entryLocation}` : `${urlBase}/blob/${this._constants.defaultBranch}/${entryLocation}`;
        content = await tryReadFile(potentialPath);
        if (content) {
          url = potentialPath;
          break; // Exit the loop once an entry point is found
        }
      }
    }

    if(!url) console.log(alertMessage);
    return { content, url };
  },

  async _entryPointFromUrl(app, repoOrFileUrl) {
    if (!repoOrFileUrl) throw new Error("Missing repoUrl");

    const alertMessage = `Could not find any entry point file in the given repo "${repoOrFileUrl}". Please add a "plugin.js" file to the repo, or specify the location of your entry file with the "entry:" directive. \n\nSee plugin instructions for more detail.`;
    return this._getEntryPoint({urlBase: repoOrFileUrl, alertMessage});
  },

  async _entryPointFromFile(app, filePath) {
    if (!filePath) throw new Error("Missing filePath");

    const alertMessage = `Could not find any entry point file in the given directory "${filePath}". Please add a "plugin.js" file to the directory, or specify the location of your entry file with the "entry:" directive. \n\nSee plugin instructions for more detail.`;
    return this._getEntryPoint({urlBase: filePath, alertMessage, filePath: true});
  }
};
export default plugin;

plugin.insertText.Refresh.run.bind(plugin)()
  .then((result) => {
    fs.writeFile('out.plugin.js', result)
      .then(() => {
        console.log('File has been written successfully');
      })
      .catch(err => {
        console.error('Error writing the file', err);
      });
  })
  .catch(err => {
    console.error('Error in run function', err);
  });

