// Local development server: serves the static site and the /api functions
// with a tiny Vercel-compatible req/res shim. No dependencies required.
//
//   npm start            -> http://localhost:3000
//   PORT=8080 npm start  -> custom port
//
// Environment variables can be placed in a `.env` file (see .env.example).

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = fileURLToPath(new URL('.', import.meta.url));
const PORT = Number(process.env.PORT) || 3000;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.txt': 'text/plain; charset=utf-8',
};

const BLOCKED = new Set(['.env', 'server.js', 'package.json', 'package-lock.json']);

function loadEnv() {
  const file = join(ROOT, '.env');
  if (!existsSync(file)) return;
  for (const line of readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (!match || line.trim().startsWith('#')) continue;
    const [, key, raw] = match;
    if (process.env[key] === undefined) process.env[key] = raw.replace(/^(['"])(.*)\1$/, '$2');
  }
}

function readJsonBody(req) {
  return new Promise((resolveBody, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > 6_000_000) {
        reject(new Error('Body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      const text = Buffer.concat(chunks).toString('utf8');
      if (!text) return resolveBody({});
      try {
        resolveBody(JSON.parse(text));
      } catch (e) {
        resolveBody(text);
      }
    });
    req.on('error', reject);
  });
}

function withHelpers(res) {
  res.status = (code) => {
    res.statusCode = code;
    return res;
  };
  res.json = (data) => {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

async function handleApi(req, res, pathname) {
  const name = pathname.slice('/api/'.length).replace(/\/$/, '');
  if (!/^[a-z0-9-]+$/i.test(name)) return false;
  const file = join(ROOT, 'api', `${name}.js`);
  if (!existsSync(file)) return false;

  const { default: handler } = await import(pathToFileURL(file).href);
  req.body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readJsonBody(req) : undefined;
  await handler(req, withHelpers(res));
  return true;
}

async function handleStatic(req, res, pathname) {
  let filePath = normalize(join(ROOT, decodeURIComponent(pathname)));
  if (!filePath.startsWith(resolve(ROOT) + sep) && filePath !== resolve(ROOT)) return false;

  try {
    const info = await stat(filePath);
    if (info.isDirectory()) filePath = join(filePath, 'index.html');
  } catch (e) {
    return false;
  }

  const rel = filePath.slice(resolve(ROOT).length + 1);
  if (BLOCKED.has(rel) || rel.split(sep).some((part) => part.startsWith('.') || part === 'node_modules')) {
    return false;
  }

  try {
    const content = await readFile(filePath);
    res.writeHead(200, {
      'Content-Type': MIME[extname(filePath).toLowerCase()] || 'application/octet-stream',
      'Cache-Control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : content);
    return true;
  } catch (e) {
    return false;
  }
}

loadEnv();

const server = createServer(async (req, res) => {
  const { pathname } = new URL(req.url, 'http://localhost');
  try {
    if (pathname.startsWith('/api/')) {
      if (await handleApi(req, res, pathname)) return;
    } else if (['GET', 'HEAD'].includes(req.method) && (await handleStatic(req, res, pathname))) {
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Not found');
  } catch (error) {
    console.error(error);
    if (!res.headersSent) res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'Internal server error' }));
  }
});

server.listen(PORT, () => {
  console.log(`Pathshala-X running at http://localhost:${PORT}`);
  if (!process.env.OPENAI_API_KEY) {
    console.log('Note: OPENAI_API_KEY is not set — the AI tutor will use its built-in offline explanations.');
  }
});
