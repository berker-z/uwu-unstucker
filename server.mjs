import http from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize, sep } from "node:path";

const host = "127.0.0.1";
const requestedPort = Number(process.argv[2] || 8000);
const root = process.cwd();
const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
const upstreamRpc = process.env.SOLANA_RPC_URL || "https://api.mainnet-beta.solana.com";

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".txt": "text/plain; charset=utf-8"
};

function localPath(url) {
  const pathname = new URL(url, `http://${host}`).pathname;
  const decoded = decodeURIComponent(pathname === "/" ? "/claim.html" : pathname);
  const candidate = normalize(join(root, decoded));
  if (candidate !== root && !candidate.startsWith(rootPrefix)) throw new Error("invalid path");
  return candidate;
}

const server = http.createServer(async (request, response) => {
  try {
    if (request.method === "POST" && request.url === "/rpc") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const body = Buffer.concat(chunks);

      const upstream = await fetch(upstreamRpc, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body
      });

      const data = Buffer.from(await upstream.arrayBuffer());
      response.writeHead(upstream.status, {
        "content-type": upstream.headers.get("content-type") || "application/json",
        "cache-control": "no-store"
      });
      response.end(data);
      return;
    }

    const file = localPath(request.url || "/");
    const data = await readFile(file);
    response.writeHead(200, {
      "content-type": contentTypes[extname(file)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(data);
  } catch (error) {
    response.writeHead(error.code === "ENOENT" ? 404 : 500, {
      "content-type": "text/plain; charset=utf-8"
    });
    response.end(error.message);
  }
});

server.listen(requestedPort, host, () => {
  const address = server.address();
  console.log(`uwu-unstucker: http://${host}:${address.port}/claim.html`);
});
