//----------------------------------------------------------------------
import fetch from "isomorphic-fetch"

//----------------------------------------------------------------------
/** Recursively process file contents, building a set of functionTranslations that indicates what the names of
 * functions are becoming as they migrate from their original location into the single code block that is returned
 * by this method
 * @param {object} entryPoint - { content: string, url: string }
 * @param {string} codeBlockString - A string for a block of code that is being constructed to insert into plugin note
 * @param {array} functionTranslations - Array of functions that have been inlined so far
 * @returns {string} - Code block text that incorporates inlined versions of all functions recursively linked from the entry point
 */
export async function inlineImportsFromGithub(entryPoint, codeBlockString, functionTranslations) {
  const { content, url } = entryPoint;
  if (!content) return null;

  const extension = url.split(".").pop();
  const importUrls = importUrlsFromContent(content, extension, url);

  if (!importUrls.length) {
    console.log("No import URLs found in", url);
    return codeBlockString;
  }

  // Ensure that final closing brace in the object is followed by a comma so we can add more after it
  const codeWithoutFinalBrace = codeBlockString.substring(0, codeBlockString.lastIndexOf("}"));
  const finalBrace = codeWithoutFinalBrace.lastIndexOf("}");
  if (finalBrace === -1) throw new Error("Could not find any functions in code block");
  if (codeBlockString[finalBrace + 1] !== ",") {
    codeBlockString = codeBlockString.substring(0, finalBrace + 1) + "," + codeBlockString.substring(finalBrace + 1);
  }

  // Process each importUrl mentioned in the entryPoint.content
  for (const importUrl of importUrls) {
    // Returns { [functionName]: [functionCode minus leading "export"], ... }
    if (functionTranslations.find(translation => translation.importUrl === importUrl)) {
      console.log("Skipping", importUrl, "because it was already inlined");
      continue;
    }
    const importFileContent = await fileContentFromUrl(importUrl);
    if (!importFileContent) {
      console.error("No file content found for", importUrl, "in", url);
      continue;
    }

    const functionBlocks = await functionBlocksFromFileContent(importFileContent);
    if (functionBlocks) {
      for (let [ functionName, functionBlock ] of Object.entries(functionBlocks)) {
        const definition = functionBlock.split("\n")[0];
        // Check if the function is async
        const isAsync = /\basync\b/.test(definition);
        // Check if the function is a generator
        const isGenerator = /function\s*\*\s*/.test(definition);
        const params = definition.match(/\(([^)]*)\)/)[1];
        const urlSegments = importUrl.split("/");
        const newFunctionName = `_inlined_${ urlSegments[urlSegments.length - 1].replace(/[^\w]/g, "_") }_${ functionName }`;
        functionTranslations.push({ functionName, newFunctionName, importUrl });
        // Create the new function definition, including the asterisk if it's a generator
        const newDefinition = `${ isAsync ? "async " : "" }${ isGenerator ? "*" : "" }${ newFunctionName }(${ params }) {`;

        let newFunctionBlock = functionBlock.replace(definition, newDefinition).split("\n").map(line => `  ${ line }`).join("\n");
        newFunctionBlock = `\n  ${ newFunctionBlock.trim() }${ newFunctionBlock.trim().endsWith(",") ? "" : "," }\n`;

        const endBracket = codeBlockString.lastIndexOf("}");
        codeBlockString = codeBlockString.substring(0, endBracket) + newFunctionBlock + codeBlockString.substring(endBracket);
      }
    }

    // If the function we're inlining mentioned another function that was inlined, ensure we update those calls
    functionTranslations.forEach(translation => {
      // First, replace all function names with the inlined version and add "this."
      // The (?<!_) negative lookahead is to prevent us from double-replacing functions, by not replacing function
      // names preceded by an underscore (as our new function names are)
      // We also make sure to not replace functions called as a field of an object by excluding the matches that
      // have a dot "." character behind the function name
      const replaceIndependentFunctionRegex = new RegExp(`(?<![\\_\\.])\\b${ translation.functionName }\\b`, "g");
      codeBlockString = codeBlockString.replace(replaceIndependentFunctionRegex, `this.${ translation.newFunctionName }`);
    });

    // Recurse to check if entryPoint.content has imports of its own to inline
    codeBlockString = await inlineImportsFromGithub({ url: importUrl, content: importFileContent }, codeBlockString, functionTranslations);
  }

  return codeBlockString;
}

//----------------------------------------------------------------------
export async function fetchWithRetry(url, { retries = 2, gracefulFail = false } = {}) {
  const timeoutSeconds = 30; // this._constants.requestTimeoutSeconds;
  let error;
  const apiURL = new URL("https://plugins.amplenote.com/cors-proxy");
  apiURL.searchParams.set("apiurl", url);

  for (let i = 0; i < retries; i++) {
    try {
      let timeoutId;
      const controller = new AbortController();
      const signal = controller.signal;
      const fetchPromise = fetch(apiURL, {
        cache: "no-store",
        method: "GET",
        headers: { "Content-Type": "text/plain" },
        signal
      });

      const timeoutPromise = new Promise((_, reject) =>
        timeoutId = setTimeout(() => {
          controller.abort(); // Abort fetch if timeout occurs
          reject(new Error('Timeout'));
        }, timeoutSeconds * 1000)
      );

      let result = await Promise.race([
        fetchPromise,
        timeoutPromise
      ]);
      clearTimeout(timeoutId);
      return result; 
    } catch (e) {
      if (gracefulFail) {
        console.log(`Failed to grab ${ url }`, e, `at ${ new Date() }. Oh well, moving on...`);
      } else {
        error = e;
        console.error(`Fetch attempt ${ i + 1 } failed with`, e, `at ${ new Date() }. Retrying...`);
      }
    }
  }

  return null;
}

//----------------------------------------------------------------------
/** Collect code blocks for a given import statement
 * @param {string} fileContent - URL of the file whose exported objects will be captured
 * @returns {object|null} - { [functionName]: [function code block, starting where function or variable is declared], ... }
 */
async function functionBlocksFromFileContent(fileContent) {
  let result = {};
  const functionRegex = /^(?:export\s+)?((?:async\s+)?function\s*(\*)?\s*(?<functionName>[^\s\(]+)\s*\(|(?:const|let)\s+(?<variableName>[^\s=]+)\s*=\s*(?:async)?\s*(?:\(\)|\((?<variableParams>[^)]+)\))\s*=>)/gm;

  const functionCodeDeclarations = Array.from(fileContent.matchAll(functionRegex));
  for (const functionDeclarationMatch of functionCodeDeclarations) {
    if (Number.isInteger(functionDeclarationMatch?.index)) {
      const functionStartIndex = functionDeclarationMatch.index;
      const remainingContent = fileContent.substring(functionStartIndex);
      const endMatch = remainingContent.match(/^}\)?;?\s*(\n|$)/m);

      if (endMatch?.index) {
        const functionEndIndex = functionStartIndex + endMatch.index + 1;
        const functionBlock = fileContent.substring(functionStartIndex, functionEndIndex);
        const functionName = functionDeclarationMatch.groups?.functionName || functionDeclarationMatch.groups?.variableName;
        const newFunctionBlock = functionBlock.replace(/export\s+/, "");
        console.log("Got object block length", newFunctionBlock?.length, "for", functionName);
        result[functionName] = newFunctionBlock;
      }
    }
  }

  return result;
}

//----------------------------------------------------------------------
// Intentionally mixing const-based function declaration for a better test when we inception plugin.test.js
// The method name `fileContentFromUrl` is checked for in test. If changing it, be a pal & change it there too?
export const fileContentFromUrl = async (url) => {
  let fileContent;
  const moduleFetchResponse = await fetchWithRetry(url, { retries: 1, gracefulFail: true });
  if (moduleFetchResponse?.ok && (fileContent = await moduleFetchResponse.text())) {
    const json = JSON.parse(fileContent);
    const lines = json.payload.blob.rawLines;
    fileContent = lines.join("\n");
    return fileContent;
  } else {
    console.log("Failed to fetch", url, "with", moduleFetchResponse);
    return null;
  }
}

//----------------------------------------------------------------------
const importUrlsFromContent = (content, extension, contentFileUrl) => {
  let match;
  const importUrls = [];
  const importRegex = /import\s+\{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g;

  while ((match = importRegex.exec(content)) !== null) {
    let importUrl = match[2];
    if (importUrl.startsWith("./")) {
      // Grab all of the URL up to the file, which will be replaced by the file we're importing
      importUrl = `${ contentFileUrl.split("/").slice(0, -1).join("/") }/${ importUrl.replace("./", "") }`;
    } else {
      // slice(0, 7) is the URL up through the branch e.g., https://github.com/alloy-org/plugin-builder/blob/main
      const baseUrl = contentFileUrl.split("/").slice(0, 7).join("/");
      importUrl = `${ baseUrl }/${ importUrl }`;
    }
    if (!/\.[jt]s$/.test(importUrl)) {
      importUrl += `.${ extension }`;
    }
    importUrls.push(importUrl);
  }
  return importUrls;
}
