// Mock HTTP server for testing Obsidian API interactions
import { serve } from "https://deno.land/std@0.208.0/http/server.ts";

export class MockObsidianServer {
  private server: Deno.HttpServer | null = null;
  private port: number;
  private handlers: Map<string, (req: Request) => Response> = new Map();

  constructor(port = 8765) {
    this.port = port;
    this.setupDefaultHandlers();
  }

  private setupDefaultHandlers() {
    // Root endpoint
    this.handlers.set("GET:/", () => 
      new Response(JSON.stringify({
        status: "OK",
        manifest: {
          id: "obsidian-local-rest-api",
          name: "Local REST API",
          version: "1.0.0",
        },
        versions: {
          obsidian: "1.0.0",
          self: "1.0.0",
        },
        service: "Obsidian Local REST API",
        authenticated: true,
      }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    // Vault endpoints
    this.handlers.set("GET:/vault/", () =>
      new Response(JSON.stringify({
        files: ["test-note.md", "folder/another-note.md", "daily/2024-01-01.md"],
      }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    this.handlers.set("GET:/vault/test-note.md", () =>
      new Response("# Test Note\n\nThis is a test note content.", {
        headers: { "Content-Type": "text/markdown" },
      })
    );

    this.handlers.set("PUT:/vault/test-note.md", () =>
      new Response(null, { status: 204 })
    );

    this.handlers.set("PATCH:/vault/test-note.md", () =>
      new Response(null, { status: 204 })
    );

    this.handlers.set("DELETE:/vault/test-note.md", () =>
      new Response(null, { status: 204 })
    );

    // Commands endpoints
    this.handlers.set("GET:/commands/", () =>
      new Response(JSON.stringify({
        commands: [
          { id: "editor:toggle-bold", name: "Toggle bold" },
          { id: "workspace:split-vertical", name: "Split vertically" },
        ],
      }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    this.handlers.set("POST:/commands/editor:toggle-bold", () =>
      new Response(null, { status: 204 })
    );

    // Active note endpoints
    this.handlers.set("GET:/active/", () =>
      new Response(JSON.stringify({
        path: "current-note.md",
        content: "# Current Note\n\nThis is the currently active note.",
      }), {
        headers: { "Content-Type": "application/json" },
      })
    );

    this.handlers.set("PUT:/active/", () =>
      new Response(null, { status: 204 })
    );

    this.handlers.set("PATCH:/active/", () =>
      new Response(null, { status: 204 })
    );

    this.handlers.set("POST:/active/", () =>
      new Response(null, { status: 204 })
    );

    // Error responses for unavailable endpoints
    this.handlers.set("GET:/search/simple/", () =>
      new Response("Not Found", { status: 404 })
    );

    this.handlers.set("POST:/search/", () =>
      new Response("Not Found", { status: 404 })
    );

    this.handlers.set("GET:/periodic/", () =>
      new Response("Not Found", { status: 404 })
    );
  }

  async start(): Promise<void> {
    const handler = (req: Request): Response => {
      const url = new URL(req.url);
      const key = `${req.method}:${url.pathname}`;
      
      // Check for authorization header
      const authHeader = req.headers.get("Authorization");
      if (!authHeader && !url.pathname.startsWith("/")) {
        return new Response("Unauthorized", { status: 401 });
      }

      const handler = this.handlers.get(key);
      if (handler) {
        return handler(req);
      }

      return new Response("Not Found", { status: 404 });
    };

    // Start server in background
    serve(handler, { port: this.port, hostname: "localhost" });
    
    // Give the server a moment to start
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async stop(): Promise<void> {
    // Mock server cleanup - in real implementation would stop the server
    this.server = null;
  }

  getUrl(): string {
    return `http://localhost:${this.port}`;
  }

  // Allow custom handlers for specific tests
  setHandler(method: string, path: string, handler: (req: Request) => Response) {
    this.handlers.set(`${method}:${path}`, handler);
  }
}