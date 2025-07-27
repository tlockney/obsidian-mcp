import { assertEquals, assertRejects } from "@std/assert";
import { ObsidianApiClient } from "./obsidian-api-client.ts";
import { MockObsidianServer } from "./mock-server.ts";

Deno.test("ObsidianApiClient Integration Tests", async (t) => {
  const mockServer = new MockObsidianServer(8766);
  let client: ObsidianApiClient;

  await t.step("Setup mock server", async () => {
    await mockServer.start();
    client = new ObsidianApiClient({
      apiUrl: mockServer.getUrl(),
      apiKey: "test-api-key",
    });
  });

  await t.step("getStatus() should return server status", async () => {
    const status = await client.getStatus();
    assertEquals(status.status, "OK");
    assertEquals(status.authenticated, true);
    assertEquals(status.manifest.name, "Local REST API");
  });

  await t.step("listFiles() should return vault files", async () => {
    const response = await client.listFiles();
    assertEquals(response.files.length, 3);
    assertEquals(response.files[0], "test-note.md");
  });

  await t.step("getFile() should return file content", async () => {
    const content = await client.getFile("test-note.md");
    assertEquals(content, "# Test Note\n\nThis is a test note content.");
  });

  await t.step("createOrUpdateFile() should succeed", async () => {
    // Should not throw
    await client.createOrUpdateFile("test-note.md", "New content");
  });

  await t.step("patchFile() should succeed", async () => {
    // Should not throw
    await client.patchFile("test-note.md", "Patch content");
  });

  await t.step("deleteFile() should succeed", async () => {
    // Should not throw
    await client.deleteFile("test-note.md");
  });

  await t.step("listCommands() should return available commands", async () => {
    const response = await client.listCommands();
    assertEquals(response.commands.length, 2);
    assertEquals(response.commands[0].id, "editor:toggle-bold");
  });

  await t.step("executeCommand() should succeed", async () => {
    // Should not throw
    await client.executeCommand("editor:toggle-bold");
  });

  await t.step("getActiveFile() should return active file info", async () => {
    const activeFile = await client.getActiveFile();
    assertEquals(typeof activeFile, "object");
  });

  await t.step("updateActiveFile() should succeed", async () => {
    // Should not throw
    await client.updateActiveFile("New active content");
  });

  await t.step("patchActiveFile() should succeed", async () => {
    // Should not throw
    await client.patchActiveFile("Patch active content");
  });

  await t.step("appendToActiveFile() should succeed", async () => {
    // Should not throw
    await client.appendToActiveFile("Appended content");
  });

  await t.step("Error handling - nonexistent file", async () => {
    mockServer.setHandler("GET", "/vault/nonexistent.md", () =>
      new Response("Not Found", { status: 404 })
    );

    await assertRejects(
      () => client.getFile("nonexistent.md"),
      Error,
      "Failed to get file"
    );
  });

  await t.step("Error handling - unauthorized request", async () => {
    const unauthorizedClient = new ObsidianApiClient({
      apiUrl: mockServer.getUrl(),
      // No API key
    });

    mockServer.setHandler("GET", "/vault/", () =>
      new Response("Unauthorized", { status: 401 })
    );

    await assertRejects(
      () => unauthorizedClient.listFiles(),
      Error
    );
  });

  await t.step("Cleanup mock server", async () => {
    await mockServer.stop();
  });
});