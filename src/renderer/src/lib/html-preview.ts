const PREVIEW_POLICY =
  "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'none'; form-action 'none'; base-uri 'none'"

export const MAX_HTML_PREVIEW_LENGTH = 2_000_000

export function sandboxedHtmlDocument(html: string): string {
  const meta = `<meta http-equiv="Content-Security-Policy" content="${PREVIEW_POLICY}">`

  if (/<head\b[^>]*>/i.test(html)) {
    return html.replace(/<head\b[^>]*>/i, (head) => `${head}${meta}`)
  }

  if (/<html\b[^>]*>/i.test(html)) {
    return html.replace(/<html\b[^>]*>/i, (opening) => `${opening}<head>${meta}</head>`)
  }

  return `<!doctype html><html><head>${meta}</head><body>${html}</body></html>`
}
