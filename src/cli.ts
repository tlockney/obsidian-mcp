import { parseArgs } from "@std/cli";
import { z } from "zod";

export interface CliConfig {
  obsidianApiUrl: string;
  apiKey?: string;
  showHelp: boolean;
}

const DEFAULT_API_URL = "http://localhost:27123";

// Version is updated by scripts/version-bump.ts
// Keep in sync with deno.json and src/main.ts
export const VERSION = "0.3.4";

export function parseCliArgs(args: string[]): CliConfig {
  const parsed = parseArgs(args, {
    string: ["api-url", "api-key"],
    boolean: ["help"],
    alias: {
      h: "help",
      u: "api-url",
      k: "api-key",
    },
    default: {
      help: false,
    },
  });

  if (parsed.help) {
    return {
      obsidianApiUrl: DEFAULT_API_URL,
      showHelp: true,
    };
  }

  // Get values from CLI args, fallback to env vars, then defaults
  const obsidianApiUrl = parsed["api-url"] ||
    Deno.env.get("OBSIDIAN_API_URL") ||
    DEFAULT_API_URL;

  const apiKey = parsed["api-key"] || Deno.env.get("OBSIDIAN_API_KEY");

  return {
    obsidianApiUrl,
    apiKey,
    showHelp: false,
  };
}

export function showHelp(): void {
  const helpText = `
Obsidian MCP Server v${VERSION}

A Model Context Protocol (MCP) server that enables AI models to interact with
Obsidian vaults through the Local REST API plugin.

USAGE:
    obsidian-mcp [OPTIONS]

OPTIONS:
    -h, --help              Show this help message
    -u, --api-url <URL>     Obsidian Local REST API URL
                            Default: http://localhost:27123
                            Env var: OBSIDIAN_API_URL
    -k, --api-key <KEY>     API key for authentication (optional)
                            Env var: OBSIDIAN_API_KEY

EXAMPLES:
    obsidian-mcp
    obsidian-mcp --api-url http://localhost:8080
    obsidian-mcp --api-url http://localhost:27123 --api-key sk-your-key-here
    
ENVIRONMENT VARIABLES:
    OBSIDIAN_API_URL       Obsidian Local REST API endpoint
    OBSIDIAN_API_KEY       API key for authentication (optional)

SETUP:
    1. Install the Obsidian Local REST API plugin
    2. Configure the plugin's API key (optional but recommended)
    3. Run this MCP server and connect it to your MCP client

For more information, visit: https://github.com/tlockney/obsidian-mcp
`;

  console.log(helpText);
}

// Configuration validation schema
const ConfigSchema = z.object({
  obsidianApiUrl: z.string().url(),
  apiKey: z.string().optional(),
});

export function validateConfig(config: Omit<CliConfig, "showHelp">): {
  obsidianApiUrl: string;
  apiKey?: string;
} {
  try {
    return ConfigSchema.parse(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      console.error("Configuration error:");
      for (const issue of error.issues) {
        console.error(`  ${issue.path.join(".")}: ${issue.message}`);
      }
    } else {
      console.error("Invalid configuration:", error);
    }
    Deno.exit(1);
  }
}
