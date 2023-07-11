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
  const moduleFetchResponse = await this._fetch(importUrl, { retries: 1, gracefulFail: true });
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
