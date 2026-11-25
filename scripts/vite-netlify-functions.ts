// Development-only Vite plugin: serves netlify/functions/<name>.ts at /api/<name>
// so `npm run dev` runs the whole app (UI + AI functions) without the Netlify CLI.
// In production, Netlify itself serves the functions (see netlify.toml).
import type { IncomingMessage, ServerResponse } from 'node:http';
import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Plugin, ViteDevServer } from 'vite';

const NAME = /^[a-z0-9-]+$/;

async function toRequest(req: IncomingMessage, url: string): Promise<Request> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const c of req) {
    size += (c as Buffer).length;
    if (size > 1024 * 1024) throw new Error('Request too large');
    chunks.push(c as Buffer);
  }
  const headers = new Headers();
  for (const [k, v] of Object.entries(req.headers)) {
    if (Array.isArray(v)) v.forEach((x) => headers.append(k, x));
    else if (v !== undefined) headers.set(k, v);
  }
  const method = req.method ?? 'GET';
  return new Request(url, { method, headers, body: method === 'GET' || method === 'HEAD' ? undefined : Buffer.concat(chunks) });
}

async function send(res: ServerResponse, response: Response) {
  res.statusCode = response.status;
  response.headers.forEach((v, k) => res.setHeader(k, v));
  res.end(Buffer.from(await response.arrayBuffer()));
}

export function netlifyFunctionsDev(): Plugin {
  return {
    name: 'salespilot:netlify-functions-dev',
    apply: 'serve',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url ?? '';
        const m = /^\/(?:api|\.netlify\/functions)\/([^/?#]+)/.exec(url);
        if (!m) return next();
        const name = m[1];
        const file = path.resolve(server.config.root, 'netlify/functions', `${name}.ts`);
        if (!NAME.test(name) || !existsSync(file)) {
          res.statusCode = 404;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'NOT_FOUND', message: `No function named "${name}"` } }));
          return;
        }
        try {
          const mod = (await server.ssrLoadModule(file)) as { default: (r: Request, ctx: unknown) => Promise<Response> };
          const request = await toRequest(req, `http://${req.headers.host ?? 'localhost'}${url}`);
          const response = await mod.default(request, {});
          await send(res, response);
        } catch (e) {
          server.config.logger.error(`[functions] ${name}: ${(e as Error).stack ?? e}`);
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'INTERNAL', message: 'Local function crashed — see the terminal.' } }));
        }
      });
    },
  };
}
