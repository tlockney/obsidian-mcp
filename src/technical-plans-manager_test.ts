import { assertEquals, assertExists } from "@std/assert";
import { TechnicalPlansManager } from "./technical-plans-manager.ts";

// Mock API client for testing
class MockApiClient {
  private files: Map<string, string> = new Map();

  async listFiles() {
    return {
      files: Array.from(this.files.keys()),
    };
  }

  async getFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (!content) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async createOrUpdateFile(path: string, content: string): Promise<void> {
    this.files.set(path, content);
  }

  async deleteFile(path: string): Promise<void> {
    this.files.delete(path);
  }

  // For testing - get all stored files
  getAllFiles(): Map<string, string> {
    return new Map(this.files);
  }
}

Deno.test("TechnicalPlansManager - createTechnicalPlan", async () => {
  const mockClient = new MockApiClient();
  const manager = new TechnicalPlansManager(mockClient as any);

  const content = "# Test Plan\nThis is a test technical plan.";
  const metadata = {
    project: "Test Project",
    type: "Architecture" as const,
    priority: "High" as const,
    source: "Claude Code" as const,
  };

  const filepath = await manager.createTechnicalPlan(content, metadata);

  // Check that file was created in inbox
  assertExists(filepath);
  assertEquals(filepath.includes("Technical Plans/Inbox"), true);

  // Check file content has frontmatter
  const files = mockClient.getAllFiles();
  const createdFile = Array.from(files.values())[0];
  assertEquals(createdFile.includes("---"), true);
  assertEquals(createdFile.includes("project: Test Project"), true);
  assertEquals(createdFile.includes("type: Architecture"), true);
  assertEquals(createdFile.includes("# Test Plan"), true);
});

Deno.test("TechnicalPlansManager - initializeStructure", async () => {
  const mockClient = new MockApiClient();
  const manager = new TechnicalPlansManager(mockClient as any);

  await manager.initializeStructure();

  const files = mockClient.getAllFiles();
  const fileKeys = Array.from(files.keys());

  // Check that .gitkeep files were created for each folder
  assertEquals(fileKeys.includes("Technical Plans/Inbox/.gitkeep"), true);
  assertEquals(fileKeys.includes("Technical Plans/Reviewed/.gitkeep"), true);
  assertEquals(fileKeys.includes("Technical Plans/Archive/.gitkeep"), true);
});

Deno.test("TechnicalPlansManager - markReviewed", async () => {
  const mockClient = new MockApiClient();
  const manager = new TechnicalPlansManager(mockClient as any);

  // Create a test file in inbox first
  const testContent = `---
created: 2025-01-01
project: Test
type: Design
priority: Medium
source: Claude
---

# Test Plan
This is a test.`;

  mockClient.createOrUpdateFile(
    "Technical Plans/Inbox/test-plan.md",
    testContent,
  );

  // Mark as reviewed
  const result = await manager.markReviewed("test-plan.md");
  assertEquals(result, true);

  // Check file was moved to reviewed folder
  const files = mockClient.getAllFiles();
  assertEquals(files.has("Technical Plans/Inbox/test-plan.md"), false);
  assertEquals(files.has("Technical Plans/Reviewed/test-plan.md"), true);

  // Check review_date was added
  const reviewedContent = files.get("Technical Plans/Reviewed/test-plan.md");
  assertExists(reviewedContent);
  assertEquals(reviewedContent.includes("review_date:"), true);
});

Deno.test("TechnicalPlansManager - listTechnicalPlans", async () => {
  const mockClient = new MockApiClient();
  const manager = new TechnicalPlansManager(mockClient as any);

  // Create test files in different folders
  await mockClient.createOrUpdateFile(
    "Technical Plans/Inbox/plan1.md",
    `---
project: Project1
type: Design
---
Content 1`,
  );

  await mockClient.createOrUpdateFile(
    "Technical Plans/Reviewed/plan2.md",
    `---
project: Project2
type: Architecture
---
Content 2`,
  );

  const allPlans = await manager.listTechnicalPlans();
  assertEquals(allPlans.length, 2);

  const inboxPlans = await manager.listTechnicalPlans("inbox");
  assertEquals(inboxPlans.length, 1);
  assertEquals(inboxPlans[0].path, "Technical Plans/Inbox/plan1.md");

  const reviewedPlans = await manager.listTechnicalPlans("reviewed");
  assertEquals(reviewedPlans.length, 1);
  assertEquals(reviewedPlans[0].path, "Technical Plans/Reviewed/plan2.md");
});
