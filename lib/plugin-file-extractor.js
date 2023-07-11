//----------------------------------------------------------------------
import fetch from "isomorphic-fetch"

//----------------------------------------------------------------------
/** Collect code blocks for a given import statement
 * @param {object} importMatch - { functions: array, module: string }
 * @param {string} filePreface - URL prefix for the file (e.g., "https://github.com/amplenote/plugin-builder/blob/main")
 * @param {string} extension - File extension (e.g., "ts")
 * @returns {object|null} - { [functionName]: [function code block, starting where function or variable is declared], ... }
 */
export async function objectBlocksFromImportMatch(importMatch) {
  let fileContent;
  let result = {};
  const { functions, importUrl } = importMatch;
  console.log("Checking presence of", importUrl);
  const moduleFetchResponse = await fetch(importUrl, { retries: 1, gracefulFail: true });
  if (moduleFetchResponse.ok && (fileContent = await moduleFetchResponse.text())) {
    console.log("Found", importUrl);
    for (const importedFunction of functions) {
      const objectRegex = new RegExp(`^export\\s+((?:async\\s+)?function\\s+${ importedFunction }\\s*\\(|` +
        `(?:const|let)\\s+${ importedFunction }\\s*=)`,
        "m");
      const objectMatch = fileContent.match(objectRegex);
      if (Number.isInteger(objectMatch?.index)) {
        let objectEndIndex;
        let functionLength = 0;
        const objectStartIndex = objectMatch.index;
        const remainingContent = fileContent.substring(objectStartIndex);
        const endMatch = remainingContent.match(/^}\)?;?\s*(\n|$)/m);

        if (endMatch?.index) {
          const objectEndIndex = objectStartIndex + endMatch.index + endMatch[0].length;
          const objectBlock = fileContent.substring(objectStartIndex, objectEndIndex);
          console.log("Got object block length", objectBlock?.length, "from", importUrl, "for", importedFunction);
          result[importedFunction] = objectBlock.replace(/export\s+/, "");
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
