import { assertEquals } from "@std/assert";
import {
  createErrorResponse,
  createSuccessResponse,
  createToolHandlers,
} from "./tools.ts";
import { ObsidianApiClient } from "./obsidian-api-client.ts";

// =============================================================================
// Mock fetch helper
// =============================================================================

interface MockResponse {
  status: number;
  statusText?: string;
  body?: string | Record<string, unknown>;
  headers?: Record<string, string>;
}

function createMockFetch(responses: Map<string, MockResponse>) {
  return (
    input: string | URL | Request,
    _init?: RequestInit,
  ): Promise<Response> => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
      ? input.toString()
      : input.url;

    // Find matching response by checking if URL contains any key
    let mockResponse: MockResponse | undefined;
    for (const [pattern, response] of responses) {
      if (url.includes(pattern)) {
        mockResponse = response;
        break;
      }
    }

    if (!mockResponse) {
      mockResponse = { status: 404, body: { message: "Not found" } };
    }

    // 204 No Content responses cannot have a body
    if (mockResponse.status === 204) {
      return Promise.resolve(
        new Response(null, {
          status: 204,
          statusText: mockResponse.statusText ?? "No Content",
          headers: mockResponse.headers,
        }),
      );
    }

    const body = typeof mockResponse.body === "string"
      ? mockResponse.body
      : JSON.stringify(mockResponse.body ?? {});

    return Promise.resolve(
      new Response(body, {
        status: mockResponse.status,
        statusText: mockResponse.statusText ?? "OK",
        headers: mockResponse.headers,
      }),
    );
  };
}

function withMockFetch<T>(
  responses: Map<string, MockResponse>,
  fn: () => Promise<T>,
): Promise<T> {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = createMockFetch(responses) as typeof fetch;
  return fn().finally(() => {
    globalThis.fetch = originalFetch;
  });
}

// =============================================================================
// Helper function tests
// =============================================================================

Deno.test("createSuccessResponse - creates proper response structure", () => {
  const response = createSuccessResponse("Test message");

  assertEquals(response.content.length, 1);
  assertEquals(response.content[0].type, "text");
  assertEquals(response.content[0].text, "Test message");
  assertEquals(response.isError, undefined);
});

Deno.test("createErrorResponse - creates error response with Error object", () => {
  const error = new Error("Test error message");
  const response = createErrorResponse("do something", error);

  assertEquals(response.content.length, 1);
  assertEquals(response.content[0].type, "text");
  assertEquals(
    response.content[0].text,
    "Failed to do something: Test error message",
  );
  assertEquals(response.isError, true);
});

Deno.test("createErrorResponse - handles non-Error objects", () => {
  const response = createErrorResponse("do something", "string error");

  assertEquals(
    response.content[0].text,
    "Failed to do something: Unknown error",
  );
  assertEquals(response.isError, true);
});

Deno.test("createErrorResponse - handles null error", () => {
  const response = createErrorResponse("do something", null);

  assertEquals(
    response.content[0].text,
    "Failed to do something: Unknown error",
  );
  assertEquals(response.isError, true);
});

// =============================================================================
// ping handler tests
// =============================================================================

Deno.test("ping handler - successful connection", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "localhost:27123/",
      {
        status: 200,
        body: {
          status: "OK",
          manifest: {
            id: "local-rest-api",
            name: "Local REST API",
            version: "1.2.0",
          },
          versions: {
            obsidian: "1.5.0",
            self: "1.2.0",
          },
          service: "Obsidian Local REST API",
          authenticated: true,
        },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.ping();

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Connected to Obsidian v1.5.0 with Local REST API v1.2.0",
    );
  });
});

Deno.test("ping handler - connection failure", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "localhost:27123/",
      {
        status: 500,
        body: { message: "Server unavailable" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.ping();

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to connect to Obsidian: Server unavailable",
    );
  });
});

// =============================================================================
// listFiles handler tests
// =============================================================================

Deno.test("listFiles handler - returns file list", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/",
      {
        status: 200,
        body: {
          files: ["note1.md", "note2.md", "folder/note3.md"],
        },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.listFiles();

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Found 3 files:\nnote1.md\nnote2.md\nfolder/note3.md",
    );
  });
});

Deno.test("listFiles handler - empty vault", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/",
      {
        status: 200,
        body: { files: [] },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.listFiles();

    assertEquals(result.isError, undefined);
    assertEquals(result.content[0].text, "Found 0 files:\n");
  });
});

Deno.test("listFiles handler - error response", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/",
      {
        status: 401,
        body: { message: "Unauthorized" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.listFiles();

    assertEquals(result.isError, true);
    assertEquals(result.content[0].text, "Failed to list files: Unauthorized");
  });
});

// =============================================================================
// getFile handler tests
// =============================================================================

Deno.test("getFile handler - returns file content", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/notes/test.md",
      {
        status: 200,
        body: "# Test Note\n\nThis is the content.",
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.getFile("notes/test.md");

    assertEquals(result.isError, undefined);
    assertEquals(result.content[0].text, "# Test Note\n\nThis is the content.");
  });
});

Deno.test("getFile handler - file not found", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/nonexistent.md",
      {
        status: 404,
        statusText: "Not Found",
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.getFile("nonexistent.md");

    assertEquals(result.isError, true);
    // Note: getFile has its own error message format (includes "Failed to get file:" prefix)
    // which gets wrapped by the handler's error response
    assertEquals(
      result.content[0].text,
      "Failed to get file: Failed to get file: Not Found",
    );
  });
});

// =============================================================================
// putFile handler tests
// =============================================================================

Deno.test("putFile handler - creates file successfully", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/new-note.md",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.putFile("new-note.md", "# New Note");

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Successfully created/updated file: new-note.md",
    );
  });
});

Deno.test("putFile handler - error creating file", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/test.md",
      {
        status: 500,
        body: { message: "Disk full" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.putFile("test.md", "content");

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to create/update file: Disk full",
    );
  });
});

// =============================================================================
// deleteFile handler tests
// =============================================================================

Deno.test("deleteFile handler - deletes file successfully", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/old-note.md",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.deleteFile("old-note.md");

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Successfully deleted file: old-note.md",
    );
  });
});

Deno.test("deleteFile handler - file not found", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/missing.md",
      {
        status: 404,
        body: { message: "File not found" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.deleteFile("missing.md");

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to delete file: File not found",
    );
  });
});

// =============================================================================
// patchFile handler tests
// =============================================================================

Deno.test("patchFile handler - patches file successfully", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/existing.md",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.patchFile("existing.md", "appended content");

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Successfully patched file: existing.md",
    );
  });
});

Deno.test("patchFile handler - error patching", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/test.md",
      {
        status: 500,
        body: { message: "File locked" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.patchFile("test.md", "content");

    assertEquals(result.isError, true);
    assertEquals(result.content[0].text, "Failed to patch file: File locked");
  });
});

// =============================================================================
// listCommands handler tests
// =============================================================================

Deno.test("listCommands handler - returns command list", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/commands/",
      {
        status: 200,
        body: {
          commands: [
            { id: "app:open-settings", name: "Open Settings" },
            { id: "editor:toggle-bold", name: "Toggle Bold" },
          ],
        },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.listCommands();

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Available commands (2):\napp:open-settings: Open Settings\neditor:toggle-bold: Toggle Bold",
    );
  });
});

Deno.test("listCommands handler - empty command list", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/commands/",
      {
        status: 200,
        body: { commands: [] },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.listCommands();

    assertEquals(result.isError, undefined);
    assertEquals(result.content[0].text, "Available commands (0):\n");
  });
});

// =============================================================================
// executeCommand handler tests
// =============================================================================

Deno.test("executeCommand handler - executes successfully", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/commands/app:open-settings",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.executeCommand("app:open-settings");

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Successfully executed command: app:open-settings",
    );
  });
});

Deno.test("executeCommand handler - command not found", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/commands/unknown:command",
      {
        status: 404,
        body: { message: "Command not found" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.executeCommand("unknown:command");

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to execute command: Command not found",
    );
  });
});

// =============================================================================
// getActive handler tests
// =============================================================================

Deno.test("getActive handler - returns active file", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 200,
        body: {
          path: "current-note.md",
          content: "# Current Note",
        },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.getActive();

    assertEquals(result.isError, undefined);
    const parsed = JSON.parse(result.content[0].text);
    assertEquals(parsed.path, "current-note.md");
    assertEquals(parsed.content, "# Current Note");
  });
});

Deno.test("getActive handler - no active file", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 404,
        body: { message: "No file is currently active" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.getActive();

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to get active file: No file is currently active",
    );
  });
});

// =============================================================================
// replaceActive handler tests
// =============================================================================

Deno.test("replaceActive handler - replaces successfully", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.replaceActive("# New Content");

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Successfully replaced active file content",
    );
  });
});

Deno.test("replaceActive handler - no active file", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 404,
        body: { message: "No active file" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.replaceActive("content");

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to replace active file: No active file",
    );
  });
});

// =============================================================================
// patchActive handler tests
// =============================================================================

Deno.test("patchActive handler - patches successfully", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.patchActive("patched content");

    assertEquals(result.isError, undefined);
    assertEquals(result.content[0].text, "Successfully patched active file");
  });
});

Deno.test("patchActive handler - error", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 500,
        body: { message: "Internal error" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.patchActive("content");

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to patch active file: Internal error",
    );
  });
});

// =============================================================================
// appendActive handler tests
// =============================================================================

Deno.test("appendActive handler - appends successfully", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.appendActive("appended text");

    assertEquals(result.isError, undefined);
    assertEquals(
      result.content[0].text,
      "Successfully appended to active file",
    );
  });
});

Deno.test("appendActive handler - error", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 403,
        body: { message: "Permission denied" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    const handlers = createToolHandlers(client);

    const result = await handlers.appendActive("content");

    assertEquals(result.isError, true);
    assertEquals(
      result.content[0].text,
      "Failed to append to active file: Permission denied",
    );
  });
});
