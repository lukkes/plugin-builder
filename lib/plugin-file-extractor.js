//----------------------------------------------------------------------
import fetch from "isomorphic-fetch"

//----------------------------------------------------------------------
export async function pluginFetch(url, { retries = 2, gracefulFail = false } = {}) {
  const timeoutSeconds = 30; // this._constants.requestTimeoutSeconds;
  let error;

  for (let i = 0; i < retries; i++) {
    try {
      return Promise.race([
        fetch(url, {
          method: "GET",
          headers: { "Content-Type": "text/plain", },
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

//----------------------------------------------------------------------
/** Collect file contents to compose a block that can be inserted into note
 * @param {object} entryPoint - { content: string, url: string }
 * @param {string} codeObject - A string for a block of code that is being constructed to insert into plugin note
 */
export const inlineImportsFromGithub = async (entryPoint, codeObject) => {
  const { content, url } = entryPoint;
  if (!content) return null;

  const importRegex = /import\s+\{\s*([^}]+)\s*\}\s+from\s+['"]([^'"]+)['"]/g;

  let match;
  const extension = url.split(".").pop();
  const functionTranslations = [];
  const importUrls = [];
  while ((match = importRegex.exec(content)) !== null) {
    let importUrl = match[2];
    if (importUrl.startsWith("./")) {
      importUrl = `${ url.split("/").slice(0, -1).join("/") }/${ importUrl.replace("./", "") }`;
    }
    if (!/\.[jt]s$/.test(importUrl)) {
      importUrl += `.${ extension }`;
    }
    importUrls.push(importUrl);
  }

  if (!importUrls.length) {
    console.log("No import URLs found in", url);
    return codeObject;
  }

  // Ensure that final closing brace in the object is followed by a comma so we can add more after it
  const codeWithoutFinalBrace = codeObject.substring(0, codeObject.lastIndexOf("}"));
  const finalBrace = codeWithoutFinalBrace.lastIndexOf("}");
  if (finalBrace === -1) throw new Error("Could not find any functions in code block");
  if (codeObject[finalBrace + 1] !== ",") {
    codeObject = codeObject.substring(0, finalBrace + 1) + "," + codeObject.substring(finalBrace + 1);
  }

  // Process each importUrl mentioned in the entryPoint.content
  for (const importUrl of importUrls) {
    // Returns { [functionName]: [functionCode minus leading "export"], ... }
    const importFileContent = fileContentFromUrl(importUrl);
    const functionBlocks = await functionBlocksFromFileContent(importFileContent);
    if (functionBlocks) {
      for (const [functionName, functionBlock] of Object.entries(functionBlocks)) {
        const definition = functionBlock.split("\n")[0];
        const isAsync = /\sasync\s/.test(definition);
        const params = definition.match(/\(([^)]+)\)/)[1];
        const newFunctionName = `_inlined_${ functionName }`;
        // If the function we're inlining mentioned another function that was inlined, ensure we update those calls
        functionTranslations.forEach(translation => {
          functionBlock.replaceAll(`${ translation.functionName }(`, `this.${ translation.newFunctionName }(`);
        })
        functionTranslations.push({ functionName, newFunctionName });
        const newDefinition = `  ${ isAsync ? "async " : "" } ${ newFunctionName }(${ params }) {`;
        const newFunctionBlock = functionBlock.replace(definition, newDefinition);
        codeObject = codeObject.replaceAll(`${ functionName }(`, `this.${ newFunctionName }(`)
        codeObject += `\n\n${ newFunctionBlock.trim() }${ newFunctionBlock.trim().endsWith(",") ? "" : "," }\n\n`;
      }
    }

    // Todo: Could recurse here if entryPoint.content has its own imports
    // codeObject = await inlineImportsFromGithub({ url: importUrl, content: importFileContent }, codeObject);
  }

  return codeObject;
}

//----------------------------------------------------------------------
/** Collect code blocks for a given import statement
 * @param {string} fileContent - URL of the file whose exported objects will be captured
 * @returns {object|null} - { [functionName]: [function code block, starting where function or variable is declared], ... }
 */
async function functionBlocksFromFileContent(fileContent) {
  let result = {};
  const objectRegex = /^(?:export\s+)?((?:async\s+)?function\s+(?<functionName>[^\s\(]+)\s*\(|(?:const|let)\s+(?<variableName>[^\s=])\s*=)/gm;
  while (fileContent.exec(objectRegex)) {
    const objectMatch = fileContent.match(objectRegex);
    if (Number.isInteger(objectMatch?.index)) {
      const objectStartIndex = objectMatch.index;
      const remainingContent = fileContent.substring(objectStartIndex);
      const endMatch = remainingContent.match(/^}\)?;?\s*(\n|$)/m);

      if (endMatch?.index) {
        const objectEndIndex = objectStartIndex + endMatch.index + endMatch[0].length;
        const objectBlock = fileContent.substring(objectStartIndex, objectEndIndex);
        const functionName = objectMatch.groups?.functionName || objectMatch.groups?.variableName;
        console.log("Got object block length", objectBlock?.length, "from", importUrl, "for", functionName);
        result[functionName] = objectBlock.replace(/export\s+/, "");
      }
    }
  }

  return result;
}

//----------------------------------------------------------------------
// Intentionally mixing const-based function declaration for a better test when we inception plugin.test.js
const fileContentFromUrl = async (url) => {
  let fileContent;
  console.log("Checking presence of", url);
  const moduleFetchResponse = await fetch(url, { retries: 1, gracefulFail: true });
  if (moduleFetchResponse.ok && (fileContent = await moduleFetchResponse.text())) {
    console.log("Found", url);
    return fileContent;
  } else {
    console.log("Failed to fetch", url, "with", moduleFetchResponse);
    return null;
  }
}
