import { assertEquals, assertExists } from "@std/assert";
import {
  ApiStatusResponseSchema,
  CommandsResponseSchema,
  ObsidianApiClient,
  VaultFilesResponseSchema,
} from "./obsidian-api-client.ts";

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
