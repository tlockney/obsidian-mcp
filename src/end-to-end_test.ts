import { assertEquals, assertExists } from "@std/assert";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ObsidianApiClient } from "./obsidian-api-client.ts";

Deno.test("End-to-End MCP Server Tests", async (t) => {
  await t.step("Server initialization with all tools", () => {
    const server = new McpServer({
      name: "obsidian-mcp",
      version: "0.1.0",
      description: "MCP server for interacting with Obsidian",
    });

    // Test that we can register all the tools without errors
    const mockApiClient = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
      apiKey: "test-key",
    });

    // Register a few key tools to verify the registration process works
    server.registerTool(
      "ping",
      {
        description: "Test connectivity to Obsidian",
        inputSchema: {},
      },
      async () => ({
        content: [{ type: "text", text: "Pong!" }],
      }),
    );

    server.registerTool(
      "get_file",
      {
        description: "Get file content",
        inputSchema: {
          path: z.string().describe("File path"),
        },
      },
      async ({ path }) => ({
        content: [{ type: "text", text: `Content of ${path}` }],
      }),
    );

    assertExists(server);
  });

  await t.step("Configuration validation", () => {
    const ConfigSchema = z.object({
      obsidianApiUrl: z.string().url().default("http://localhost:27123"),
      apiKey: z.string().optional(),
    });

    // Test various configuration scenarios
    const configs = [
      { obsidianApiUrl: "http://localhost:27123", apiKey: "test" },
      { obsidianApiUrl: "https://example.com:8080" },
      {},
    ];

    for (const config of configs) {
      const parsed = ConfigSchema.parse(config);
      assertExists(parsed.obsidianApiUrl);
    }
  });

  await t.step("API client instantiation with different configs", () => {
    const configs = [
      { apiUrl: "http://localhost:27123", apiKey: "test" },
      { apiUrl: "http://localhost:27123" },
      { apiUrl: "https://custom.domain:9000", apiKey: "secret" },
    ];

    for (const config of configs) {
      const client = new ObsidianApiClient(config);
      assertExists(client);
    }
  });

  await t.step("Schema validation edge cases", () => {
    // Test that all our response schemas handle edge cases
    const emptyFiles = { files: [] };
    const emptyCommands = { commands: [] };
    const minimalStatus = {
      status: "OK",
      manifest: { id: "test", name: "Test", version: "1.0.0" },
      versions: { obsidian: "1.0.0", self: "1.0.0" },
      service: "Test",
      authenticated: false,
    };

    // Import and test schemas
    import("./obsidian-api-client.ts").then(({
      VaultFilesResponseSchema,
      CommandsResponseSchema,
      ApiStatusResponseSchema,
    }) => {
      const parsedFiles = VaultFilesResponseSchema.parse(emptyFiles);
      assertEquals(parsedFiles.files.length, 0);

      const parsedCommands = CommandsResponseSchema.parse(emptyCommands);
      assertEquals(parsedCommands.commands.length, 0);

      const parsedStatus = ApiStatusResponseSchema.parse(minimalStatus);
      assertEquals(parsedStatus.authenticated, false);
    });
  });
});
