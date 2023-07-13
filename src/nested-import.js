import { inlineImportsFromGithub, pluginFetch } from "lib/plugin-file-extractor"

export function wrappedFetch(url, options) {
  return pluginFetch(url, options)
}
