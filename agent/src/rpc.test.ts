import { once } from "node:events";
import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it } from "vitest";
import { createRpcProvider } from "./rpc.js";

const servers: Server[] = [];

async function listen(server: Server): Promise<string> {
  servers.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Test server did not bind to a TCP port");
  return `http://127.0.0.1:${address.port}`;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map(async (server) => {
    server.closeAllConnections();
    if (!server.listening) return;
    await new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    });
  }));
});

describe("createRpcProvider", () => {
  it("rejects an empty RPC list", () => {
    expect(() => createRpcProvider(["", "  "], 11155111)).toThrow(/At least one RPC URL/);
  });

  it("deduplicates providers and uses availability quorum", () => {
    const provider = createRpcProvider(["https://rpc.example", " https://rpc.example "], 11155111);
    expect(provider.providerConfigs).toHaveLength(1);
    expect(provider.quorum).toBe(1);
    provider.destroy();
  });

  it("fails over when the primary RPC returns an error", async () => {
    const brokenUrl = await listen(createServer((_request, response) => {
      response.statusCode = 503;
      response.end("unavailable");
    }));
    const healthyUrl = await listen(createServer(async (request, response) => {
      let body = "";
      for await (const chunk of request) body += chunk;
      const payload = JSON.parse(body) as { id: number; method: string } | Array<{ id: number; method: string }>;
      const requests = Array.isArray(payload) ? payload : [payload];
      const results = requests.map(({ id, method }) => ({
        jsonrpc: "2.0",
        id,
        result: method === "eth_chainId" ? "0xaa36a7" : "0x7b",
      }));
      response.setHeader("content-type", "application/json");
      response.end(JSON.stringify(Array.isArray(payload) ? results : results[0]));
    }));

    const provider = createRpcProvider([brokenUrl, healthyUrl], 11155111, 10);
    await expect(provider.getBlockNumber()).resolves.toBe(123);
    provider.destroy();
  });
});
