// Minimal dependency-free MCP server over stdio (newline-delimited JSON-RPC 2.0).
// Implements initialize, ping and tools/list and tools/call for one tool, "echo".
// stdout carries protocol messages only; diagnostics go to stderr.
import { createInterface } from "node:readline";

const PROTOCOL_VERSION = "2025-06-18";

const tools = [
  {
    name: "echo",
    description: "Return the supplied text unchanged.",
    inputSchema: {
      type: "object",
      properties: { text: { type: "string", description: "Text to echo back" } },
      required: ["text"],
    },
  },
];

const send = (message) => process.stdout.write(`${JSON.stringify(message)}\n`);
const reply = (id, result) => send({ jsonrpc: "2.0", id, result });
const fail = (id, code, message) => send({ jsonrpc: "2.0", id, error: { code, message } });

function handle(request) {
  const { id, method, params } = request;
  if (id === undefined) return; // notifications (e.g. notifications/initialized) need no reply
  switch (method) {
    case "initialize":
      return reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "example-mcp-echo", version: "0.1.0" },
      });
    case "ping":
      return reply(id, {});
    case "tools/list":
      return reply(id, { tools });
    case "tools/call": {
      if (params?.name !== "echo") return fail(id, -32602, `Unknown tool: ${params?.name}`);
      const text = params.arguments?.text;
      if (typeof text !== "string") return fail(id, -32602, "Argument 'text' must be a string");
      return reply(id, { content: [{ type: "text", text }] });
    }
    default:
      return fail(id, -32601, `Method not found: ${method}`);
  }
}

createInterface({ input: process.stdin }).on("line", (line) => {
  if (line.trim() === "") return;
  let request;
  try {
    request = JSON.parse(line);
  } catch {
    return fail(null, -32700, "Parse error");
  }
  handle(request);
});
