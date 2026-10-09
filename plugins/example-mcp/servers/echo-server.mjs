/* Minimal dependency-free MCP server over stdio (newline-delimited JSON-RPC 2.0).
   Implements initialize, ping and tools/list and tools/call for one tool, "echo".
   stdout carries protocol messages only; diagnostics go to stderr. */
import { createInterface } from 'node:readline';

const PROTOCOL_VERSION = '2025-06-18';

/** JSON-RPC 2.0 error codes (https://www.jsonrpc.org/specification#error_object). */
const PARSE_ERROR = -32_700;
const INVALID_REQUEST = -32_600;
const METHOD_NOT_FOUND = -32_601;
const INVALID_PARAMS = -32_602;

/** @typedef {number | string | null} RequestId */

/** @typedef {{ id?: RequestId, method?: string, params?: unknown }} Request */

const tools = [
  {
    name: 'echo',
    description: 'Return the supplied text unchanged.',
    inputSchema: {
      type: 'object',
      properties: { text: { type: 'string', description: 'Text to echo back' } },
      required: ['text'],
    },
  },
];

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * @param {unknown} message
 * @returns {void}
 */
function send(message) {
  process.stdout.write(`${JSON.stringify(message)}\n`);
}

/**
 * @param {RequestId} id
 * @param {unknown} result
 * @returns {void}
 */
function reply(id, result) {
  send({ jsonrpc: '2.0', id, result });
}

/**
 * @param {RequestId} id
 * @param {number} code
 * @param {string} message
 * @returns {void}
 */
function fail(id, code, message) {
  send({ jsonrpc: '2.0', id, error: { code, message } });
}

/**
 * Answers the arguments of a `tools/call` request for the "echo" tool.
 * @param {RequestId} id
 * @param {unknown} params
 * @returns {void}
 */
function callTool(id, params) {
  const name = isRecord(params) ? params.name : undefined;

  if (!isRecord(params) || name !== 'echo') {
    fail(id, INVALID_PARAMS, `Unknown tool: ${typeof name === 'string' ? name : 'none'}`);

    return;
  }

  const text = isRecord(params.arguments) ? params.arguments.text : undefined;

  if (typeof text !== 'string') {
    fail(id, INVALID_PARAMS, "Argument 'text' must be a string");

    return;
  }

  reply(id, { content: [{ type: 'text', text }] });
}

/**
 * @param {Request} request
 * @returns {void}
 */
function handle(request) {
  const { id, method, params } = request;

  // Notifications (for example notifications/initialized) carry no id and need no reply.
  if (id === undefined) return;

  if (method === undefined) {
    fail(id, INVALID_REQUEST, 'Invalid Request');

    return;
  }

  switch (method) {
    case 'initialize':
      reply(id, {
        protocolVersion: PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: 'example-mcp-echo', version: '0.1.0' },
      });
      break;
    case 'ping':
      reply(id, {});
      break;
    case 'tools/list':
      reply(id, { tools });
      break;
    case 'tools/call':
      callTool(id, params);
      break;
    default:
      fail(id, METHOD_NOT_FOUND, `Method not found: ${method}`);
  }
}

createInterface({ input: process.stdin }).on('line', (line) => {
  if (line.trim() === '') return;

  /** @type {unknown} */
  let request;

  try {
    request = JSON.parse(line);
  } catch {
    fail(null, PARSE_ERROR, 'Parse error');

    return;
  }

  if (!isRecord(request)) {
    fail(null, INVALID_REQUEST, 'Invalid Request');

    return;
  }

  handle(request);
});
