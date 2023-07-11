//----------------------------------------------------------------------
import fetch from "isomorphic-fetch"

//----------------------------------------------------------------------
/** Collect code blocks for a given import statement
 * @param {object} importMatch - { functions: array, module: string }
 * @param {string} filePreface - URL prefix for the file (e.g., "https://github.com/amplenote/plugin-builder/blob/main")
 * @param {string} extension - File extension (e.g., "ts")
 * @returns {object|null} - { [functionName]: [function code block, starting where function or variable is declared] }
 */
export async function objectBlocksFromImportMatch(importMatch, filePreface, extension) {
  let fileContent;
  let result = {};
  const { functions, module } = importMatch;
  const importUrl = `${ filePreface }/${ module }.${ extension }`;
  console.log("Checking presence of", importUrl);
  const moduleFetchResponse = await fetch(importUrl, { retries: 1, gracefulFail: true });
  if (moduleFetchResponse.ok && (fileContent = await moduleFetchResponse.text())) {
    console.log("Found", importUrl);
    for(const importedFunction in functions) {
      const objectRegex = new RegExp(`^export\\s+(function\\s+${ functions[importedFunction] }\\s*\\(|` +
        `const\\s+${ functions[importedFunction] }\\s*=|` +
        `class\\s+${ functions[importedFunction] }\\s*\\{)`,
        "m");
      const objectMatch = fileContent.match(objectRegex);
      if (Number.isInteger(objectMatch?.index)) {
        const objectStartIndex = objectMatch.index;
        let objectEndIndex;
        let openBracketCount = 0;
        for (let index = objectStartIndex; index < fileContent.length; index++) {
          if (fileContent[index] === "{") {
            openBracketCount++;
          } else if (fileContent[index] === "}") {
            if (openBracketCount === 1) {
              objectEndIndex = index;
              break;
            } else if (openBracketCount <= 0) {
              if (window) window.alert("Error parsing plugin file");
              console.error("Error parsing plugin file");
              break;
            } else {
              openBracketCount--;
            }
          }
        }

        if (!Number.isInteger(objectEndIndex)) {
          const objectBlock = fileContent.substring(objectStartIndex, objectEndIndex);
          console.log("Got object block length", objectBlock?.length, "from", importUrl, "for", importedFunction);
          result[importedFunction] = objectBlock;
        }
      }
    }
  } else {
    console.log("Failed to fetch", importUrl, "with", moduleFetchResponse);
  }
  return result;
}

//----------------------------------------------------------------------
export async function pluginFetch(url, { retries = 2, gracefulFail = false } = {}) {
  const timeoutSeconds = 30; // this._constants.requestTimeoutSeconds;
  let error;

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
      if (gracefulFail) {
        console.log(`Failed to grab ${ url }`, e, `at ${ new Date() }. Oh well, moving on...`);
      } else {
        debugger;
        error = e;
        console.log(`Attempt ${ i + 1 } failed with`, e, `at ${ new Date() }. Retrying...`);
      }
    }
  }

  return null;
}
