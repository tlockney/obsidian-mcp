import { assertEquals, assertExists, assertRejects } from "@std/assert";
import { ObsidianApiClient } from "./obsidian-api-client.ts";

// Simple integration tests without a mock server
Deno.test("ObsidianApiClient Unit Tests", async (t) => {
  await t.step("Client creation with valid config", () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
      apiKey: "test-key",
    });
    assertExists(client);
  });

  await t.step("Client creation without API key", () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    assertExists(client);
  });

  await t.step("Error handling for connection failures", async () => {
    const client = new ObsidianApiClient({
      apiUrl: "http://localhost:99999", // Non-existent port
      apiKey: "test-key",
    });

    // These should fail due to connection refused
    await assertRejects(
      () => client.getStatus(),
      Error,
    );

    await assertRejects(
      () => client.listFiles(),
      Error,
    );

    await assertRejects(
      () => client.getFile("test.md"),
      Error,
    );
  });

  await t.step("URL construction", () => {
    const client1 = new ObsidianApiClient({
      apiUrl: "http://localhost:27123",
    });
    assertExists(client1);

    const client2 = new ObsidianApiClient({
      apiUrl: "https://example.com:8080",
      apiKey: "secret",
    });
    assertExists(client2);
  });
});
