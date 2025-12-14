import { assertEquals, assertThrows } from "@std/assert";
import { parseCliArgs, showHelp, validateConfig } from "./cli.ts";

// Store original env vars for cleanup
const originalApiUrl = Deno.env.get("OBSIDIAN_API_URL");
const originalApiKey = Deno.env.get("OBSIDIAN_API_KEY");

function cleanupEnv() {
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

function clearEnv() {
  Deno.env.delete("OBSIDIAN_API_URL");
  Deno.env.delete("OBSIDIAN_API_KEY");
}

// =============================================================================
// parseCliArgs tests
// =============================================================================

Deno.test("parseCliArgs - returns defaults when no arguments provided", () => {
  clearEnv();
  try {
    const config = parseCliArgs([]);

    assertEquals(config.obsidianApiUrl, "http://localhost:27123");
    assertEquals(config.apiKey, undefined);
    assertEquals(config.showHelp, false);
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - parses --help flag", () => {
  const config = parseCliArgs(["--help"]);

  assertEquals(config.showHelp, true);
  assertEquals(config.obsidianApiUrl, "http://localhost:27123");
});

Deno.test("parseCliArgs - parses -h shorthand for help", () => {
  const config = parseCliArgs(["-h"]);

  assertEquals(config.showHelp, true);
});

Deno.test("parseCliArgs - parses --api-url argument", () => {
  clearEnv();
  try {
    const config = parseCliArgs(["--api-url", "http://custom.local:8080"]);

    assertEquals(config.obsidianApiUrl, "http://custom.local:8080");
    assertEquals(config.showHelp, false);
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - parses -u shorthand for api-url", () => {
  clearEnv();
  try {
    const config = parseCliArgs(["-u", "http://short.local:9000"]);

    assertEquals(config.obsidianApiUrl, "http://short.local:9000");
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - parses --api-key argument", () => {
  clearEnv();
  try {
    const config = parseCliArgs(["--api-key", "my-secret-key"]);

    assertEquals(config.apiKey, "my-secret-key");
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - parses -k shorthand for api-key", () => {
  clearEnv();
  try {
    const config = parseCliArgs(["-k", "short-key"]);

    assertEquals(config.apiKey, "short-key");
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - parses multiple arguments together", () => {
  clearEnv();
  try {
    const config = parseCliArgs([
      "--api-url",
      "http://multi.local:7777",
      "--api-key",
      "multi-key",
    ]);

    assertEquals(config.obsidianApiUrl, "http://multi.local:7777");
    assertEquals(config.apiKey, "multi-key");
    assertEquals(config.showHelp, false);
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - uses environment variables as fallback", () => {
  try {
    Deno.env.set("OBSIDIAN_API_URL", "http://env.local:5555");
    Deno.env.set("OBSIDIAN_API_KEY", "env-key");

    const config = parseCliArgs([]);

    assertEquals(config.obsidianApiUrl, "http://env.local:5555");
    assertEquals(config.apiKey, "env-key");
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - CLI arguments take precedence over env vars", () => {
  try {
    Deno.env.set("OBSIDIAN_API_URL", "http://env.local:5555");
    Deno.env.set("OBSIDIAN_API_KEY", "env-key");

    const config = parseCliArgs([
      "--api-url",
      "http://cli.local:6666",
      "--api-key",
      "cli-key",
    ]);

    assertEquals(config.obsidianApiUrl, "http://cli.local:6666");
    assertEquals(config.apiKey, "cli-key");
  } finally {
    cleanupEnv();
  }
});

Deno.test("parseCliArgs - help flag returns early with defaults", () => {
  // When help is requested, should return early with defaults
  // regardless of other env vars
  try {
    Deno.env.set("OBSIDIAN_API_URL", "http://env.local:5555");

    const config = parseCliArgs(["--help"]);

    assertEquals(config.showHelp, true);
    // Should have default URL, not env var, since it returns early
    assertEquals(config.obsidianApiUrl, "http://localhost:27123");
  } finally {
    cleanupEnv();
  }
});

// =============================================================================
// showHelp tests
// =============================================================================

Deno.test("showHelp - outputs help text without throwing", () => {
  // Capture console.log output
  const originalLog = console.log;
  let capturedOutput = "";

  console.log = (msg: string) => {
    capturedOutput = msg;
  };

  try {
    showHelp();

    // Verify key content is present
    assertEquals(capturedOutput.includes("Obsidian MCP Server"), true);
    assertEquals(capturedOutput.includes("--help"), true);
    assertEquals(capturedOutput.includes("--api-url"), true);
    assertEquals(capturedOutput.includes("--api-key"), true);
    assertEquals(capturedOutput.includes("OBSIDIAN_API_URL"), true);
    assertEquals(capturedOutput.includes("OBSIDIAN_API_KEY"), true);
    assertEquals(capturedOutput.includes("http://localhost:27123"), true);
  } finally {
    console.log = originalLog;
  }
});

Deno.test("showHelp - includes usage examples", () => {
  const originalLog = console.log;
  let capturedOutput = "";

  console.log = (msg: string) => {
    capturedOutput = msg;
  };

  try {
    showHelp();

    assertEquals(capturedOutput.includes("EXAMPLES:"), true);
    assertEquals(capturedOutput.includes("obsidian-mcp"), true);
  } finally {
    console.log = originalLog;
  }
});

// =============================================================================
// validateConfig tests
// =============================================================================

Deno.test("validateConfig - accepts valid config with URL and key", () => {
  const result = validateConfig({
    obsidianApiUrl: "http://localhost:27123",
    apiKey: "test-key",
  });

  assertEquals(result.obsidianApiUrl, "http://localhost:27123");
  assertEquals(result.apiKey, "test-key");
});

Deno.test("validateConfig - accepts valid config without api key", () => {
  const result = validateConfig({
    obsidianApiUrl: "http://localhost:27123",
  });

  assertEquals(result.obsidianApiUrl, "http://localhost:27123");
  assertEquals(result.apiKey, undefined);
});

Deno.test("validateConfig - accepts HTTPS URLs", () => {
  const result = validateConfig({
    obsidianApiUrl: "https://secure.example.com:443",
    apiKey: "secure-key",
  });

  assertEquals(result.obsidianApiUrl, "https://secure.example.com:443");
});

Deno.test("validateConfig - accepts URLs with paths", () => {
  const result = validateConfig({
    obsidianApiUrl: "http://localhost:27123/api/v1",
  });

  assertEquals(result.obsidianApiUrl, "http://localhost:27123/api/v1");
});

Deno.test("validateConfig - rejects invalid URL format", () => {
  // validateConfig calls Deno.exit(1) on error, so we need to mock it
  const originalExit = Deno.exit;
  const originalError = console.error;
  let exitCode: number | undefined;
  const errorMessages: string[] = [];

  // @ts-ignore - mocking Deno.exit
  Deno.exit = (code?: number) => {
    exitCode = code;
    throw new Error("Deno.exit called");
  };

  console.error = (...args: unknown[]) => {
    errorMessages.push(args.map(String).join(" "));
  };

  try {
    assertThrows(
      () => validateConfig({ obsidianApiUrl: "not-a-valid-url" }),
      Error,
      "Deno.exit called",
    );

    assertEquals(exitCode, 1);
    assertEquals(
      errorMessages.some((m) => m.includes("Configuration error")),
      true,
    );
  } finally {
    Deno.exit = originalExit;
    console.error = originalError;
  }
});

Deno.test("validateConfig - rejects empty URL", () => {
  const originalExit = Deno.exit;
  const originalError = console.error;
  let exitCode: number | undefined;

  // @ts-ignore - mocking Deno.exit
  Deno.exit = (code?: number) => {
    exitCode = code;
    throw new Error("Deno.exit called");
  };

  console.error = () => {};

  try {
    assertThrows(
      () => validateConfig({ obsidianApiUrl: "" }),
      Error,
      "Deno.exit called",
    );

    assertEquals(exitCode, 1);
  } finally {
    Deno.exit = originalExit;
    console.error = originalError;
  }
});

Deno.test("validateConfig - accepts empty string for api key", () => {
  // Empty string should be treated as no key (optional field)
  const result = validateConfig({
    obsidianApiUrl: "http://localhost:27123",
    apiKey: "",
  });

  assertEquals(result.obsidianApiUrl, "http://localhost:27123");
  assertEquals(result.apiKey, "");
});
