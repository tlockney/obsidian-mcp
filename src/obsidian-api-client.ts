import { z } from "zod";

// API Response schemas
export const VaultFilesResponseSchema = z.object({
  files: z.array(z.string()),
});

export const CommandSchema = z.object({
  id: z.string(),
  name: z.string(),
});

export const CommandsResponseSchema = z.object({
  commands: z.array(CommandSchema),
});

export const ApiStatusResponseSchema = z.object({
  status: z.string(),
  manifest: z.object({
    id: z.string(),
    name: z.string(),
    version: z.string(),
  }).passthrough(),
  versions: z.object({
    obsidian: z.string(),
    self: z.string(),
  }),
  service: z.string(),
  authenticated: z.boolean(),
}).passthrough();

// Types
export type VaultFilesResponse = z.infer<typeof VaultFilesResponseSchema>;
export type CommandsResponse = z.infer<typeof CommandsResponseSchema>;
export type ApiStatusResponse = z.infer<typeof ApiStatusResponseSchema>;

export interface ObsidianApiClientConfig {
  apiUrl: string;
  apiKey?: string;
}

export class ObsidianApiClient {
  private apiUrl: string;
  private headers: Record<string, string>;

  constructor(config: ObsidianApiClientConfig) {
    this.apiUrl = config.apiUrl;
    this.headers = {
      "Content-Type": "application/json",
    };

    if (config.apiKey) {
      this.headers["Authorization"] = `Bearer ${config.apiKey}`;
    }
  }

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const url = `${this.apiUrl}${path}`;
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.headers,
        ...options.headers,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage: string;
      try {
        const errorJson = JSON.parse(errorText);
        errorMessage = errorJson.message || `HTTP error! status: ${response.status}`;
      } catch {
        errorMessage = errorText || `HTTP error! status: ${response.status}`;
      }
      throw new Error(errorMessage);
    }

    // Handle 204 No Content responses
    if (response.status === 204) {
      return {} as T;
    }

    const text = await response.text();
    if (!text) {
      return {} as T;
    }

    try {
      return JSON.parse(text);
    } catch {
      // If JSON parsing fails, return the text wrapped in an object
      return { content: text } as unknown as T;
    }
  }

  // API Methods

  async getStatus(): Promise<ApiStatusResponse> {
    const response = await this.request<ApiStatusResponse>("/");
    return ApiStatusResponseSchema.parse(response);
  }

  async listFiles(): Promise<VaultFilesResponse> {
    const response = await this.request<VaultFilesResponse>("/vault/");
    return VaultFilesResponseSchema.parse(response);
  }

  async getFile(path: string): Promise<string> {
    const response = await fetch(`${this.apiUrl}/vault/${path}`, {
      headers: this.headers,
    });

    if (!response.ok) {
      throw new Error(`Failed to get file: ${response.statusText}`);
    }

    return response.text();
  }

  async createOrUpdateFile(path: string, content: string): Promise<void> {
    await this.request(`/vault/${path}`, {
      method: "PUT",
      headers: {
        ...this.headers,
        "Content-Type": "text/markdown",
      },
      body: content,
    });
  }

  async deleteFile(path: string): Promise<void> {
    await this.request(`/vault/${path}`, {
      method: "DELETE",
    });
  }

  async patchFile(path: string, content: string): Promise<void> {
    await this.request(`/vault/${path}`, {
      method: "PATCH",
      headers: {
        ...this.headers,
        "Content-Type": "text/markdown",
      },
      body: content,
    });
  }

  async listCommands(): Promise<CommandsResponse> {
    const response = await this.request<CommandsResponse>("/commands/");
    return CommandsResponseSchema.parse(response);
  }

  async executeCommand(commandId: string): Promise<void> {
    await this.request(`/commands/${commandId}`, {
      method: "POST",
    });
  }

  async getActiveFile(): Promise<unknown> {
    // Note: The active endpoint seems to have response format issues
    // Returning unknown until we can determine the correct format
    return this.request("/active/");
  }

  async updateActiveFile(content: string): Promise<void> {
    await this.request("/active/", {
      method: "PUT",
      headers: {
        ...this.headers,
        "Content-Type": "text/markdown",
      },
      body: content,
    });
  }

  async patchActiveFile(content: string): Promise<void> {
    await this.request("/active/", {
      method: "PATCH",
      headers: {
        ...this.headers,
        "Content-Type": "text/markdown",
      },
      body: content,
    });
  }

  async appendToActiveFile(content: string): Promise<void> {
    await this.request("/active/", {
      method: "POST",
      headers: {
        ...this.headers,
        "Content-Type": "text/markdown",
      },
      body: content,
    });
  }
}