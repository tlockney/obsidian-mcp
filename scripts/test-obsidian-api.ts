#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

import { load } from "@std/dotenv";

// Load environment variables
await load({ export: true });

const apiUrl = Deno.env.get("OBSIDIAN_API_URL") || "http://localhost:27123";
const apiKey = Deno.env.get("OBSIDIAN_API_KEY");

const headers: Record<string, string> = {
  "Content-Type": "application/json",
};

if (apiKey) {
  headers["Authorization"] = `Bearer ${apiKey}`;
}

console.log("Testing Obsidian Local REST API...");
console.log(`API URL: ${apiUrl}`);
console.log(`API Key configured: ${apiKey ? "Yes" : "No"}`);
console.log("---");

// Test various endpoints
const endpoints = [
  { path: "/", method: "GET", description: "Root endpoint" },
  { path: "/vault/", method: "GET", description: "List vault files" },
  { path: "/commands/", method: "GET", description: "List available commands" },
  { path: "/periodic/", method: "GET", description: "Get periodic notes info" },
];

for (const endpoint of endpoints) {
  console.log(
    `\nTesting ${endpoint.description}: ${endpoint.method} ${endpoint.path}`,
  );

  try {
    const response = await fetch(`${apiUrl}${endpoint.path}`, {
      method: endpoint.method,
      headers,
    });

    console.log(`Status: ${response.status} ${response.statusText}`);

    if (response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const data = await response.json();
        console.log("Response:", JSON.stringify(data, null, 2));
      } else {
        const text = await response.text();
        console.log("Response:", text);
      }
    } else {
      const errorText = await response.text();
      console.log("Error response:", errorText);
    }
  } catch (error) {
    console.error(
      "Request failed:",
      error instanceof Error ? error.message : error,
    );
  }
}

// Test creating a file
console.log("\n---\nTesting file creation...");
const testFileName = "test-file-" + Date.now() + ".md";
const testContent =
  "# Test File\n\nThis is a test file created by the Obsidian MCP server.";

try {
  const createResponse = await fetch(`${apiUrl}/vault/${testFileName}`, {
    method: "PUT",
    headers: {
      ...headers,
      "Content-Type": "text/markdown",
    },
    body: testContent,
  });

  console.log(
    `Create file status: ${createResponse.status} ${createResponse.statusText}`,
  );

  if (createResponse.ok) {
    console.log("File created successfully!");

    // Try to read it back
    const readResponse = await fetch(`${apiUrl}/vault/${testFileName}`, {
      method: "GET",
      headers,
    });

    if (readResponse.ok) {
      const content = await readResponse.text();
      console.log("File content retrieved:", content);
    }

    // Clean up - delete the test file
    const deleteResponse = await fetch(`${apiUrl}/vault/${testFileName}`, {
      method: "DELETE",
      headers,
    });

    console.log(
      `Delete file status: ${deleteResponse.status} ${deleteResponse.statusText}`,
    );
  }
} catch (error) {
  console.error(
    "File operation failed:",
    error instanceof Error ? error.message : error,
  );
}

// Test active note endpoints
console.log("\n---\nTesting active note endpoints...");
try {
  const activeResponse = await fetch(`${apiUrl}/active/`, {
    method: "GET",
    headers,
  });

  console.log(
    `Get active note status: ${activeResponse.status} ${activeResponse.statusText}`,
  );

  if (activeResponse.ok) {
    const activeData = await activeResponse.json();
    console.log("Active note info:", JSON.stringify(activeData, null, 2));
  }
} catch (error) {
  console.error(
    "Active note request failed:",
    error instanceof Error ? error.message : error,
  );
}

// Test search endpoint
console.log("\n---\nTesting search endpoints...");
try {
  const searchResponse = await fetch(`${apiUrl}/search/simple/?query=test`, {
    method: "GET",
    headers,
  });

  console.log(
    `Search status: ${searchResponse.status} ${searchResponse.statusText}`,
  );

  if (searchResponse.ok) {
    const searchData = await searchResponse.json();
    console.log(
      "Search results:",
      JSON.stringify(searchData, null, 2).substring(0, 500) + "...",
    );
  }
} catch (error) {
  console.error(
    "Search request failed:",
    error instanceof Error ? error.message : error,
  );
}
