import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { load } from "@std/dotenv";
import { ObsidianApiClient } from "./obsidian-api-client.ts";
import { parseCliArgs, showHelp, validateConfig } from "./cli.ts";
import { createToolHandlers } from "./tools.ts";

// Load environment variables
await load({ export: true });

// Parse CLI arguments
const cliConfig = parseCliArgs(Deno.args);

// Show help and exit if requested
if (cliConfig.showHelp) {
  showHelp();
  Deno.exit(0);
}

// Validate and use configuration
const config = validateConfig({
  obsidianApiUrl: cliConfig.obsidianApiUrl,
  apiKey: cliConfig.apiKey,
});

// Create the MCP server instance
const server = new McpServer({
  name: "obsidian-mcp",
  version: "0.3.4",
  description:
    "MCP server for interacting with Obsidian through the Local REST API",
});

// Create API client
const apiClient = new ObsidianApiClient({
  apiUrl: config.obsidianApiUrl,
  apiKey: config.apiKey,
});

// Create tool handlers using the shared implementation
const handlers = createToolHandlers(apiClient);

// Register tools

// Connection test
server.registerTool(
  "ping",
  {
    description: "Test connectivity to Obsidian",
    inputSchema: {},
  },
  handlers.ping,
);

// List files
server.registerTool(
  "list_files",
  {
    description: "List all files in the Obsidian vault",
    inputSchema: {},
  },
  handlers.listFiles,
);

// Get file content
server.registerTool(
  "get_file",
  {
    description: "Get the content of a file from the Obsidian vault",
    inputSchema: {
      path: z.string().describe("Path to the file relative to vault root"),
    },
  },
  ({ path }: { path: string }) => handlers.getFile(path),
);

// Create or update file
server.registerTool(
  "put_file",
  {
    description: "Create or update a file in the Obsidian vault",
    inputSchema: {
      path: z.string().describe(
        "Path where the file should be created/updated",
      ),
      content: z.string().describe("Content of the file"),
    },
  },
  ({ path, content }: { path: string; content: string }) =>
    handlers.putFile(path, content),
);

// Delete file
server.registerTool(
  "delete_file",
  {
    description: "Delete a file from the Obsidian vault",
    inputSchema: {
      path: z.string().describe("Path to the file to delete"),
    },
  },
  ({ path }: { path: string }) => handlers.deleteFile(path),
);

// Patch file (partial update)
server.registerTool(
  "patch_file",
  {
    description: "Partially update a file in the Obsidian vault",
    inputSchema: {
      path: z.string().describe("Path to the file to patch"),
      content: z.string().describe("Content to patch/update in the file"),
    },
  },
  ({ path, content }: { path: string; content: string }) =>
    handlers.patchFile(path, content),
);

// List commands
server.registerTool(
  "list_commands",
  {
    description: "List all available Obsidian commands",
    inputSchema: {},
  },
  handlers.listCommands,
);

// Execute command
server.registerTool(
  "execute_command",
  {
    description: "Execute an Obsidian command",
    inputSchema: {
      commandId: z.string().describe("The ID of the command to execute"),
    },
  },
  ({ commandId }: { commandId: string }) =>
    handlers.executeCommand(commandId),
);

// Get active file
server.registerTool(
  "get_active",
  {
    description: "Get the currently active note in Obsidian",
    inputSchema: {},
  },
  handlers.getActive,
);

// Update active file (replace)
server.registerTool(
  "replace_active",
  {
    description: "Replace the content of the currently active note",
    inputSchema: {
      content: z.string().describe("New content for the active note"),
    },
  },
  ({ content }: { content: string }) => handlers.replaceActive(content),
);

// Patch active file
server.registerTool(
  "patch_active",
  {
    description: "Partially update the currently active note",
    inputSchema: {
      content: z.string().describe("Content to patch in the active note"),
    },
  },
  ({ content }: { content: string }) => handlers.patchActive(content),
);

// Append to active file
server.registerTool(
  "append_active",
  {
    description: "Append content to the currently active note",
    inputSchema: {
      content: z.string().describe("Content to append to the active note"),
    },
  },
  ({ content }: { content: string }) => handlers.appendActive(content),
);

// Main function to start the server
async function main() {
  console.error("Starting Obsidian MCP Server...");
  console.error(`Obsidian API URL: ${config.obsidianApiUrl}`);
  console.error(`API Key configured: ${config.apiKey ? "Yes" : "No"}`);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  console.error("Obsidian MCP Server is running");
}

// Run the server if this is the main module
if (import.meta.main) {
  try {
    await main();
  } catch (error) {
    console.error("Fatal error:", error);
    Deno.exit(1);
  }
}
