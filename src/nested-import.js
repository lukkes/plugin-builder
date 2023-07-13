import { fetchWithRetry } from "lib/plugin-import-inliner"

export function wrappedFetch(url, options) {
  return fetchWithRetry(url, options)
}
