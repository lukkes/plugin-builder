import { fetchWithRetry } from "lib/plugin-import-inliner"

export async function wrappedFetch(url, options) {
  return fetchWithRetry(url, options)
}
