import { assertEquals, assertExists } from "@std/assert";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

Deno.test("MCP Server Creation", () => {
  const server = new McpServer({
    name: "test-server",
    version: "0.0.1",
  });

  assertExists(server);
});

Deno.test("Config Schema Validation", () => {
  const ConfigSchema = z.object({
    obsidianApiUrl: z.string().url().default("http://localhost:27123"),
    apiKey: z.string().optional(),
  });

  // Test valid config
  const validConfig = ConfigSchema.parse({
    obsidianApiUrl: "http://localhost:27123",
    apiKey: "test-key",
  });

  assertEquals(validConfig.obsidianApiUrl, "http://localhost:27123");
  assertEquals(validConfig.apiKey, "test-key");

  // Test config with defaults
  const defaultConfig = ConfigSchema.parse({});
  assertEquals(defaultConfig.obsidianApiUrl, "http://localhost:27123");
  assertEquals(defaultConfig.apiKey, undefined);

  // Test invalid URL
  try {
    ConfigSchema.parse({
      obsidianApiUrl: "not-a-url",
    });
    // If we get here, the test should fail
    throw new Error("Expected schema validation to fail");
  } catch (error) {
    // Verify it's a ZodError
    assertEquals(error instanceof z.ZodError, true);
  }
});

Deno.test("Environment Variable Processing", () => {
  // Test environment variable handling
  const originalApiUrl = Deno.env.get("OBSIDIAN_API_URL");
  const originalApiKey = Deno.env.get("OBSIDIAN_API_KEY");

  try {
    // Set test environment variables
    Deno.env.set("OBSIDIAN_API_URL", "http://test.example.com:8080");
    Deno.env.set("OBSIDIAN_API_KEY", "test-env-key");

    const ConfigSchema = z.object({
      obsidianApiUrl: z.string().url().default("http://localhost:27123"),
      apiKey: z.string().optional(),
    });

    const config = ConfigSchema.parse({
      obsidianApiUrl: Deno.env.get("OBSIDIAN_API_URL") ||
        "http://localhost:27123",
      apiKey: Deno.env.get("OBSIDIAN_API_KEY"),
    });

    assertEquals(config.obsidianApiUrl, "http://test.example.com:8080");
    assertEquals(config.apiKey, "test-env-key");
  } finally {
    // Restore original environment variables
    if (originalApiUrl !== undefined) {
      Deno.env.set("OBSIDIAN_API_URL", originalApiUrl);
    } else {
      Deno.env.delete("OBSIDIAN_API_URL");
    }

    if (originalApiKey !== undefined) {
      Deno.env.set("OBSIDIAN_API_KEY", originalApiKey);
    } else {
      Deno.env.delete("OBSIDIAN_API_KEY");
    }
  }
});
