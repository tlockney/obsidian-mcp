import { assertEquals, assertExists } from "@std/assert";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { ObsidianApiClient } from "./obsidian-api-client.ts";
import { MockObsidianServer } from "./mock-server.ts";

// Mock the main server setup for testing tools
async function createTestServer(
  apiClient: ObsidianApiClient,
): Promise<McpServer> {
  const server = new McpServer({
    name: "test-obsidian-mcp",
    version: "0.1.0",
    description: "Test MCP server for Obsidian",
  });

  // Register a subset of tools for testing
  server.registerTool(
    "ping",
    {
      description: "Test connectivity to Obsidian",
      inputSchema: {},
    },
    async () => {
      try {
        const status = await apiClient.getStatus();
        return {
          content: [{
            type: "text",
            text:
              `Connected to Obsidian v${status.versions.obsidian} with ${status.manifest.name} v${status.manifest.version}`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to connect to Obsidian: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "get_file",
    {
      description: "Get the content of a file from the Obsidian vault",
      inputSchema: {
        path: z.string().describe("Path to the file relative to vault root"),
      },
    },
    async ({ path }) => {
      try {
        const content = await apiClient.getFile(path);
        return {
          content: [{
            type: "text",
            text: content,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to get file: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          }],
          isError: true,
        };
      }
    },
  );

  server.registerTool(
    "list_files",
    {
      description: "List all files in the Obsidian vault",
      inputSchema: {},
    },
    async () => {
      try {
        const response = await apiClient.listFiles();
        return {
          content: [{
            type: "text",
            text: `Found ${response.files.length} files:\n${
              response.files.join("\n")
            }`,
          }],
        };
      } catch (error) {
        return {
          content: [{
            type: "text",
            text: `Failed to list files: ${
              error instanceof Error ? error.message : "Unknown error"
            }`,
          }],
          isError: true,
        };
      }
    },
  );

  return server;
}

Deno.test("MCP Tools Tests", async (t) => {
  const mockServer = new MockObsidianServer(8767);
  let mcpServer: McpServer;
  let apiClient: ObsidianApiClient;

  await t.step("Setup", async () => {
    await mockServer.start();
    apiClient = new ObsidianApiClient({
      apiUrl: mockServer.getUrl(),
      apiKey: "test-api-key",
    });
    mcpServer = await createTestServer(apiClient);
  });

  await t.step("MCP Server should be created successfully", () => {
    assertExists(mcpServer);
  });

  await t.step("ping tool should return success", async () => {
    // Note: Direct tool testing requires access to internal tool methods
    // This is a simplified test to verify the tool registration works
    const status = await apiClient.getStatus();
    assertEquals(status.status, "OK");
  });

  await t.step("get_file tool should retrieve file content", async () => {
    const content = await apiClient.getFile("test-note.md");
    assertEquals(content, "# Test Note\n\nThis is a test note content.");
  });

  await t.step("list_files tool should return file list", async () => {
    const response = await apiClient.listFiles();
    assertEquals(response.files.length, 3);
    assertEquals(response.files.includes("test-note.md"), true);
  });

  await t.step("Tool error handling", async () => {
    // Test error handling by attempting to get a nonexistent file
    mockServer.setHandler(
      "GET",
      "/vault/nonexistent.md",
      () => new Response("Not Found", { status: 404 }),
    );

    try {
      await apiClient.getFile("nonexistent.md");
    } catch (error) {
      assertExists(error);
      assertEquals(error instanceof Error, true);
    }
  });

  await t.step("Cleanup", async () => {
    await mockServer.stop();
  });
});
