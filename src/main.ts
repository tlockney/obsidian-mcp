import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";
import { load } from "@std/dotenv";
import { ObsidianApiClient } from "./obsidian-api-client.ts";
import { parseCliArgs, showHelp, validateConfig } from "./cli.ts";
import { TechnicalPlansManager } from "./technical-plans-manager.ts";

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

// Create Technical Plans Manager
const techPlansManager = new TechnicalPlansManager(apiClient);

// Initialize Technical Plans structure (async but non-blocking)
techPlansManager.initializeStructure().catch((error) => {
  console.error(
    "Warning: Failed to initialize Technical Plans structure:",
    error,
  );
});

// Register tools

// Connection test
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

// List files
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

// Get file content
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
  async ({ path, content }) => {
    try {
      await apiClient.createOrUpdateFile(path, content);
      return {
        content: [{
          type: "text",
          text: `Successfully created/updated file: ${path}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to create/update file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
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
  async ({ path }) => {
    try {
      await apiClient.deleteFile(path);
      return {
        content: [{
          type: "text",
          text: `Successfully deleted file: ${path}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to delete file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// List commands
server.registerTool(
  "list_commands",
  {
    description: "List all available Obsidian commands",
    inputSchema: {},
  },
  async () => {
    try {
      const response = await apiClient.listCommands();
      const commandList = response.commands
        .map((cmd) => `${cmd.id}: ${cmd.name}`)
        .join("\n");
      return {
        content: [{
          type: "text",
          text:
            `Available commands (${response.commands.length}):\n${commandList}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to list commands: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
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
  async ({ commandId }) => {
    try {
      await apiClient.executeCommand(commandId);
      return {
        content: [{
          type: "text",
          text: `Successfully executed command: ${commandId}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to execute command: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
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
  async ({ path, content }) => {
    try {
      await apiClient.patchFile(path, content);
      return {
        content: [{
          type: "text",
          text: `Successfully patched file: ${path}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to patch file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// Get active file
server.registerTool(
  "get_active",
  {
    description: "Get the currently active note in Obsidian",
    inputSchema: {},
  },
  async () => {
    try {
      const activeFile = await apiClient.getActiveFile();
      return {
        content: [{
          type: "text",
          text: JSON.stringify(activeFile, null, 2),
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to get active file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
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
  async ({ content }) => {
    try {
      await apiClient.updateActiveFile(content);
      return {
        content: [{
          type: "text",
          text: "Successfully replaced active file content",
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to replace active file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
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
  async ({ content }) => {
    try {
      await apiClient.patchActiveFile(content);
      return {
        content: [{
          type: "text",
          text: "Successfully patched active file",
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to patch active file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
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
  async ({ content }) => {
    try {
      await apiClient.appendToActiveFile(content);
      return {
        content: [{
          type: "text",
          text: "Successfully appended to active file",
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to append to active file: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// Technical Plans Management Tools

// Create technical plan
server.registerTool(
  "create_technical_plan",
  {
    description: "Create a new technical plan document in the Inbox",
    inputSchema: {
      content: z.string().describe("The content of the technical plan"),
      project: z.string().describe("Project name"),
      type: z.enum(["Architecture", "Implementation", "Research", "Design"])
        .describe("Type of technical plan"),
      priority: z.enum(["High", "Medium", "Low"])
        .describe("Priority level")
        .optional(),
      source: z.enum(["Claude", "Claude Code", "Other LLM"])
        .describe("Source LLM")
        .optional(),
    },
  },
  async ({ content, project, type, priority, source }) => {
    try {
      const filepath = await techPlansManager.createTechnicalPlan(content, {
        project,
        type,
        priority,
        source,
      });
      return {
        content: [{
          type: "text",
          text: `Successfully created technical plan: ${filepath}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to create technical plan: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// Mark plan as reviewed
server.registerTool(
  "mark_plan_reviewed",
  {
    description:
      "Mark a technical plan as reviewed (moves from Inbox to Reviewed)",
    inputSchema: {
      filename: z.string().describe("Filename of the plan to mark as reviewed"),
    },
  },
  async ({ filename }) => {
    try {
      await techPlansManager.markReviewed(filename);
      return {
        content: [{
          type: "text",
          text: `Successfully marked ${filename} as reviewed`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to mark plan as reviewed: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// Archive plan
server.registerTool(
  "archive_plan",
  {
    description: "Archive a technical plan",
    inputSchema: {
      filename: z.string().describe("Filename of the plan to archive"),
    },
  },
  async ({ filename }) => {
    try {
      await techPlansManager.archivePlan(filename);
      return {
        content: [{
          type: "text",
          text: `Successfully archived ${filename}`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to archive plan: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// List technical plans
server.registerTool(
  "list_technical_plans",
  {
    description: "List technical plans, optionally filtered by folder",
    inputSchema: {
      folder: z.enum(["inbox", "reviewed", "archive"])
        .describe("Specific folder to list plans from")
        .optional(),
    },
  },
  async ({ folder }) => {
    try {
      const plans = await techPlansManager.listTechnicalPlans(folder);
      const plansList = plans.map((p) => {
        const filename = p.path.split("/").pop();
        const status = p.path.includes("/Inbox/")
          ? "Inbox"
          : p.path.includes("/Reviewed/")
          ? "Reviewed"
          : "Archive";
        return `[${status}] ${filename}${
          p.metadata ? ` - ${p.metadata.project} (${p.metadata.type})` : ""
        }`;
      }).join("\n");

      return {
        content: [{
          type: "text",
          text: plans.length > 0
            ? `Technical Plans (${plans.length}):\n${plansList}`
            : "No technical plans found",
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to list technical plans: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// Get plan metadata
server.registerTool(
  "get_plan_metadata",
  {
    description: "Get metadata for a specific technical plan",
    inputSchema: {
      filename: z.string().describe("Filename of the plan"),
    },
  },
  async ({ filename }) => {
    try {
      const metadata = await techPlansManager.getPlanMetadata(filename);
      return {
        content: [{
          type: "text",
          text: metadata
            ? JSON.stringify(metadata, null, 2)
            : "No metadata found for this plan",
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to get plan metadata: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
);

// Archive old reviewed plans
server.registerTool(
  "archive_old_reviewed_plans",
  {
    description: "Archive reviewed plans older than specified days",
    inputSchema: {
      daysOld: z.number()
        .min(1)
        .describe("Number of days old to consider for archiving"),
    },
  },
  async ({ daysOld }) => {
    try {
      const count = await techPlansManager.archiveOldReviewed(daysOld);
      return {
        content: [{
          type: "text",
          text: `Successfully archived ${count} old reviewed plans`,
        }],
      };
    } catch (error) {
      return {
        content: [{
          type: "text",
          text: `Failed to archive old plans: ${
            error instanceof Error ? error.message : "Unknown error"
          }`,
        }],
        isError: true,
      };
    }
  },
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
  main().catch((error) => {
    console.error("Fatal error:", error);
    Deno.exit(1);
  });
}
