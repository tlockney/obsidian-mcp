import { assertEquals, assertExists, assertRejects } from "@std/assert";
import {
  ApiStatusResponseSchema,
  CommandsResponseSchema,
  ObsidianApiClient,
  VaultFilesResponseSchema,
} from "./obsidian-api-client.ts";

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

    // Find matching response by checking if URL starts with any key
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

Deno.test("ObsidianApiClient Schema Validation", () => {
  // Test ApiStatusResponse schema
  const validStatus = {
    status: "OK",
    manifest: {
      id: "test",
      name: "Test Plugin",
      version: "1.0.0",
    },
    versions: {
      obsidian: "1.0.0",
      self: "1.0.0",
    },
    service: "Test Service",
    authenticated: true,
  };

  const parsedStatus = ApiStatusResponseSchema.parse(validStatus);
  assertEquals(parsedStatus.status, "OK");
  assertEquals(parsedStatus.authenticated, true);

  // Test VaultFilesResponse schema
  const validFiles = {
    files: ["file1.md", "file2.md", "folder/file3.md"],
  };

  const parsedFiles = VaultFilesResponseSchema.parse(validFiles);
  assertEquals(parsedFiles.files.length, 3);

  // Test CommandsResponse schema
  const validCommands = {
    commands: [
      { id: "cmd1", name: "Command 1" },
      { id: "cmd2", name: "Command 2" },
    ],
  };

  const parsedCommands = CommandsResponseSchema.parse(validCommands);
  assertEquals(parsedCommands.commands.length, 2);
});

Deno.test("ObsidianApiClient Creation", () => {
  const client = new ObsidianApiClient({
    apiUrl: "http://localhost:27123",
    apiKey: "test-key",
  });

  assertExists(client);

  // Test client creation without API key
  const clientNoAuth = new ObsidianApiClient({
    apiUrl: "http://localhost:27123",
  });

  assertExists(clientNoAuth);
});

Deno.test("ObsidianApiClient Configuration", () => {
  // Test with API key
  const clientWithAuth = new ObsidianApiClient({
    apiUrl: "http://localhost:27123",
    apiKey: "secret-key",
  });

  assertExists(clientWithAuth);

  // Test without API key
  const clientNoAuth = new ObsidianApiClient({
    apiUrl: "http://localhost:27123",
  });

  assertExists(clientNoAuth);

  // Test with different URL
  const clientDifferentUrl = new ObsidianApiClient({
    apiUrl: "http://example.com:8080",
    apiKey: "test-key",
  });

  assertExists(clientDifferentUrl);
});

Deno.test("Schema Validation Edge Cases", () => {
  // Test ApiStatusResponse with extra fields (should pass through)
  const statusWithExtra = {
    status: "OK",
    manifest: {
      id: "test",
      name: "Test Plugin",
      version: "1.0.0",
      extraField: "should be preserved",
    },
    versions: {
      obsidian: "1.0.0",
      self: "1.0.0",
    },
    service: "Test Service",
    authenticated: true,
    extraTopLevel: "also preserved",
  };

  const parsed = ApiStatusResponseSchema.parse(statusWithExtra);
  assertEquals(parsed.status, "OK");
  // @ts-ignore - accessing passthrough field
  assertEquals(parsed.extraTopLevel, "also preserved");

  // Test empty file list
  const emptyFiles = { files: [] };
  const parsedEmpty = VaultFilesResponseSchema.parse(emptyFiles);
  assertEquals(parsedEmpty.files.length, 0);

  // Test empty commands list
  const emptyCommands = { commands: [] };
  const parsedEmptyCommands = CommandsResponseSchema.parse(emptyCommands);
  assertEquals(parsedEmptyCommands.commands.length, 0);
});

// =============================================================================
// HTTP Request Tests with Mocking
// =============================================================================

Deno.test("getStatus - successful response", async () => {
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
      apiKey: "test-key",
    });

    const status = await client.getStatus();

    assertEquals(status.status, "OK");
    assertEquals(status.manifest.name, "Local REST API");
    assertEquals(status.versions.obsidian, "1.5.0");
    assertEquals(status.authenticated, true);
  });
});

Deno.test("listFiles - successful response", async () => {
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

    const result = await client.listFiles();

    assertEquals(result.files.length, 3);
    assertEquals(result.files[0], "note1.md");
    assertEquals(result.files[2], "folder/note3.md");
  });
});

Deno.test("getFile - successful response", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/test-note.md",
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

    const content = await client.getFile("test-note.md");

    assertEquals(content, "# Test Note\n\nThis is the content.");
  });
});

Deno.test("createOrUpdateFile - successful response", async () => {
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

    // Should not throw
    await client.createOrUpdateFile("new-note.md", "# New Note");
  });
});

Deno.test("deleteFile - successful response", async () => {
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

    // Should not throw
    await client.deleteFile("old-note.md");
  });
});

Deno.test("patchFile - successful response", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/existing-note.md",
      {
        status: 204,
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });

    // Should not throw
    await client.patchFile("existing-note.md", "Appended content");
  });
});

Deno.test("listCommands - successful response", async () => {
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

    const result = await client.listCommands();

    assertEquals(result.commands.length, 2);
    assertEquals(result.commands[0].id, "app:open-settings");
    assertEquals(result.commands[1].name, "Toggle Bold");
  });
});

Deno.test("executeCommand - successful response", async () => {
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

    // Should not throw
    await client.executeCommand("app:open-settings");
  });
});

Deno.test("getActiveFile - successful response", async () => {
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

    const result = await client.getActiveFile();

    // Returns unknown, so we need to cast
    const activeFile = result as { path: string; content: string };
    assertEquals(activeFile.path, "current-note.md");
  });
});

Deno.test("updateActiveFile - successful response", async () => {
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

    // Should not throw
    await client.updateActiveFile("# Updated Content");
  });
});

Deno.test("patchActiveFile - successful response", async () => {
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

    // Should not throw
    await client.patchActiveFile("Patched content");
  });
});

Deno.test("appendToActiveFile - successful response", async () => {
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

    // Should not throw
    await client.appendToActiveFile("Appended content");
  });
});

// =============================================================================
// Error Handling Tests
// =============================================================================

Deno.test("getStatus - handles 401 Unauthorized", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "localhost:27123/",
      {
        status: 401,
        statusText: "Unauthorized",
        body: { message: "Invalid API key" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
      apiKey: "wrong-key",
    });

    await assertRejects(
      () => client.getStatus(),
      Error,
      "Invalid API key",
    );
  });
});

Deno.test("getFile - handles 404 Not Found", async () => {
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

    await assertRejects(
      () => client.getFile("nonexistent.md"),
      Error,
      "Not Found",
    );
  });
});

Deno.test("createOrUpdateFile - handles 500 Server Error", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/vault/test.md",
      {
        status: 500,
        statusText: "Internal Server Error",
        body: { message: "Vault is locked" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });

    await assertRejects(
      () => client.createOrUpdateFile("test.md", "content"),
      Error,
      "Vault is locked",
    );
  });
});

Deno.test("listCommands - handles error response with plain text", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/commands/",
      {
        status: 503,
        statusText: "Service Unavailable",
        body: "Obsidian is not running",
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });

    await assertRejects(
      () => client.listCommands(),
      Error,
      "Obsidian is not running",
    );
  });
});

Deno.test("executeCommand - handles 404 for unknown command", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/commands/unknown:command",
      {
        status: 404,
        statusText: "Not Found",
        body: { message: "Command not found" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });

    await assertRejects(
      () => client.executeCommand("unknown:command"),
      Error,
      "Command not found",
    );
  });
});

Deno.test("getActiveFile - handles 404 when no file is active", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "/active/",
      {
        status: 404,
        statusText: "Not Found",
        body: { message: "No file is currently active" },
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });

    await assertRejects(
      () => client.getActiveFile(),
      Error,
      "No file is currently active",
    );
  });
});

Deno.test("error response - falls back to status code when no message", async () => {
  const responses = new Map<string, MockResponse>([
    [
      "localhost:27123/",
      {
        status: 418,
        statusText: "I'm a teapot",
        body: "",
      },
    ],
  ]);

  await withMockFetch(responses, async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });

    await assertRejects(
      () => client.getStatus(),
      Error,
      "HTTP error! status: 418",
    );
  });
});
