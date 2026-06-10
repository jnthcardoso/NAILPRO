// Servidor descartável SÓ para validar headers de segurança localmente.
// Serve dist/ aplicando EXATAMENTE os headers do vercel.json (que o Vite dev
// não aplica), reproduzindo a borda da Vercel. Não faz parte do app.
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { extname, join, normalize } from 'node:path'

const ROOT = new URL('../dist/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')
const PORT = 4178

// Lê os headers do vercel.json para garantir que testamos o que vai pra produção.
const vercel = JSON.parse(await readFile(new URL('../vercel.json', import.meta.url)))
const HEADERS = (vercel.headers?.[0]?.headers ?? []).map(h => [h.key, h.value])

const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.webmanifest': 'application/manifest+json',
}

createServer(async (req, res) => {
  for (const [k, v] of HEADERS) res.setHeader(k, v)
  let urlPath = decodeURIComponent(new URL(req.url, 'http://x').pathname)
  let filePath = normalize(join(ROOT, urlPath))
  if (!filePath.startsWith(normalize(ROOT))) { res.statusCode = 403; return res.end('forbidden') }
  if (urlPath === '/' || !existsSync(filePath)) filePath = join(ROOT, 'index.html') // SPA fallback
  try {
    const body = await readFile(filePath)
    res.setHeader('Content-Type', MIME[extname(filePath)] ?? 'application/octet-stream')
    res.end(body)
  } catch {
    res.statusCode = 404; res.end('not found')
  }
}).listen(PORT, () => console.log(`headers-preview on http://localhost:${PORT}`))
