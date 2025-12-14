import { ObsidianApiClient } from "./obsidian-api-client.ts";

/**
 * MCP tool response content item
 */
export interface ToolContent {
  type: "text";
  text: string;
  [key: string]: unknown;
}

/**
 * MCP tool response
 */
export interface ToolResponse {
  content: ToolContent[];
  isError?: boolean;
  [key: string]: unknown;
}

/**
 * Creates an error response for MCP tools
 */
export function createErrorResponse(
  operation: string,
  error: unknown,
): ToolResponse {
  const message = error instanceof Error ? error.message : "Unknown error";
  return {
    content: [{ type: "text", text: `Failed to ${operation}: ${message}` }],
    isError: true,
  };
}

/**
 * Creates a success response for MCP tools
 */
export function createSuccessResponse(text: string): ToolResponse {
  return {
    content: [{ type: "text", text }],
  };
}

/**
 * Tool handler functions that can be tested independently.
 * These functions contain the core business logic for each MCP tool.
 */
export function createToolHandlers(apiClient: ObsidianApiClient) {
  return {
    ping: async (): Promise<ToolResponse> => {
      try {
        const status = await apiClient.getStatus();
        return createSuccessResponse(
          `Connected to Obsidian v${status.versions.obsidian} with ${status.manifest.name} v${status.manifest.version}`,
        );
      } catch (error) {
        return createErrorResponse("connect to Obsidian", error);
      }
    },

    listFiles: async (): Promise<ToolResponse> => {
      try {
        const response = await apiClient.listFiles();
        return createSuccessResponse(
          `Found ${response.files.length} files:\n${response.files.join("\n")}`,
        );
      } catch (error) {
        return createErrorResponse("list files", error);
      }
    },

    getFile: async (path: string): Promise<ToolResponse> => {
      try {
        const content = await apiClient.getFile(path);
        return createSuccessResponse(content);
      } catch (error) {
        return createErrorResponse("get file", error);
      }
    },

    putFile: async (path: string, content: string): Promise<ToolResponse> => {
      try {
        await apiClient.createOrUpdateFile(path, content);
        return createSuccessResponse(
          `Successfully created/updated file: ${path}`,
        );
      } catch (error) {
        return createErrorResponse("create/update file", error);
      }
    },

    deleteFile: async (path: string): Promise<ToolResponse> => {
      try {
        await apiClient.deleteFile(path);
        return createSuccessResponse(`Successfully deleted file: ${path}`);
      } catch (error) {
        return createErrorResponse("delete file", error);
      }
    },

    patchFile: async (path: string, content: string): Promise<ToolResponse> => {
      try {
        await apiClient.patchFile(path, content);
        return createSuccessResponse(`Successfully patched file: ${path}`);
      } catch (error) {
        return createErrorResponse("patch file", error);
      }
    },

    listCommands: async (): Promise<ToolResponse> => {
      try {
        const response = await apiClient.listCommands();
        const commandList = response.commands
          .map((cmd) => `${cmd.id}: ${cmd.name}`)
          .join("\n");
        return createSuccessResponse(
          `Available commands (${response.commands.length}):\n${commandList}`,
        );
      } catch (error) {
        return createErrorResponse("list commands", error);
      }
    },

    executeCommand: async (commandId: string): Promise<ToolResponse> => {
      try {
        await apiClient.executeCommand(commandId);
        return createSuccessResponse(
          `Successfully executed command: ${commandId}`,
        );
      } catch (error) {
        return createErrorResponse("execute command", error);
      }
    },

    getActive: async (): Promise<ToolResponse> => {
      try {
        const activeFile = await apiClient.getActiveFile();
        return createSuccessResponse(JSON.stringify(activeFile, null, 2));
      } catch (error) {
        return createErrorResponse("get active file", error);
      }
    },

    replaceActive: async (content: string): Promise<ToolResponse> => {
      try {
        await apiClient.updateActiveFile(content);
        return createSuccessResponse(
          "Successfully replaced active file content",
        );
      } catch (error) {
        return createErrorResponse("replace active file", error);
      }
    },

    patchActive: async (content: string): Promise<ToolResponse> => {
      try {
        await apiClient.patchActiveFile(content);
        return createSuccessResponse("Successfully patched active file");
      } catch (error) {
        return createErrorResponse("patch active file", error);
      }
    },

    appendActive: async (content: string): Promise<ToolResponse> => {
      try {
        await apiClient.appendToActiveFile(content);
        return createSuccessResponse("Successfully appended to active file");
      } catch (error) {
        return createErrorResponse("append to active file", error);
      }
    },
  };
}

export type ToolHandlers = ReturnType<typeof createToolHandlers>;
