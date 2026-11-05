// E2E テスト専用。out/ を GitHub Pages と同じ basePath の下で配信する。
// 仕様: docs/specs/game-screen.md
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";

const BASE_PATH = "/kono-poke-dare";
const HOST = "127.0.0.1";
const port = Number(process.env.E2E_PORT ?? "3100");
const root = resolve("out");

const CONTENT_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".woff2": "font/woff2",
};

/** 配信するファイルのパスを返す。basePath の外と out/ の外は null にする。 */
async function resolveFile(pathname: string): Promise<string | null> {
  if (pathname !== BASE_PATH && !pathname.startsWith(`${BASE_PATH}/`)) {
    return null;
  }
  const relative = decodeURIComponent(pathname.slice(BASE_PATH.length));
  const path = resolve(join(root, relative));
  if (path !== root && !path.startsWith(`${root}${sep}`)) {
    return null;
  }
  const info = await stat(path).catch(() => null);
  if (info?.isDirectory()) {
    return join(path, "index.html");
  }
  return info?.isFile() ? path : null;
}

await stat(join(root, "index.html")).catch(() => {
  console.error("out/index.html がありません。先に pnpm build を実行します。");
  process.exit(1);
});

createServer(async (request, response) => {
  try {
    const { pathname } = new URL(request.url ?? "/", `http://${HOST}`);
    const path = await resolveFile(pathname);
    if (path === null) {
      response.writeHead(404).end("not found");
      return;
    }
    const body = await readFile(path);
    response
      .writeHead(200, {
        "Content-Type":
          CONTENT_TYPES[extname(path)] ?? "application/octet-stream",
      })
      .end(body);
  } catch {
    response.writeHead(400).end("bad request");
  }
}).listen(port, HOST);
