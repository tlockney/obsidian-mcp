import { ObsidianApiClient } from "./obsidian-api-client.ts";
import { z } from "zod";

// Frontmatter schema for technical plans
export const TechnicalPlanMetadataSchema = z.object({
  created: z.string(),
  source: z.enum(["Claude", "Claude Code", "Other LLM"]),
  type: z.enum(["Architecture", "Implementation", "Research", "Design"]),
  project: z.string(),
  priority: z.enum(["High", "Medium", "Low"]),
  review_date: z.string().optional(),
  next_action: z.string().optional(),
});

export type TechnicalPlanMetadata = z.infer<typeof TechnicalPlanMetadataSchema>;

export interface FileInfo {
  path: string;
  metadata?: TechnicalPlanMetadata;
}

export class TechnicalPlansManager {
  private apiClient: ObsidianApiClient;
  private readonly basePath = "Technical Plans";
  private readonly folders = {
    inbox: "Technical Plans/Inbox",
    reviewed: "Technical Plans/Reviewed",
    archive: "Technical Plans/Archive",
  };

  constructor(apiClient: ObsidianApiClient) {
    this.apiClient = apiClient;
  }

  /**
   * Initialize the Technical Plans directory structure
   */
  async initializeStructure(): Promise<void> {
    try {
      // Check if base directory exists by trying to list files
      const allFiles = await this.apiClient.listFiles();

      // Create directories if they don't exist
      for (const folder of Object.values(this.folders)) {
        const folderExists = allFiles.files.some((f) =>
          f.startsWith(folder + "/") || f === folder
        );

        if (!folderExists) {
          // Create a placeholder file to ensure directory exists
          const placeholderPath = `${folder}/.gitkeep`;
          await this.apiClient.createOrUpdateFile(
            placeholderPath,
            "# This file ensures the directory exists\n",
          );
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to initialize Technical Plans structure: ${error}`,
      );
    }
  }

  /**
   * Parse frontmatter from markdown content
   */
  private parseFrontmatter(
    content: string,
  ): { metadata: Record<string, unknown>; content: string } {
    const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
      return { metadata: {}, content };
    }

    const [, frontmatterStr, mainContent] = match;
    const metadata: Record<string, unknown> = {};

    // Simple YAML parsing
    const lines = frontmatterStr.split("\n");
    for (const line of lines) {
      const colonIndex = line.indexOf(":");
      if (colonIndex > 0) {
        const key = line.substring(0, colonIndex).trim();
        const value = line.substring(colonIndex + 1).trim();
        metadata[key] = value;
      }
    }

    return { metadata, content: mainContent };
  }

  /**
   * Generate frontmatter string from metadata
   */
  private generateFrontmatter(
    metadata: Partial<TechnicalPlanMetadata>,
  ): string {
    const lines = ["---"];
    for (const [key, value] of Object.entries(metadata)) {
      if (value !== undefined) {
        lines.push(`${key}: ${value}`);
      }
    }
    lines.push("---", "");
    return lines.join("\n");
  }

  /**
   * Generate filename for a technical plan
   */
  private generateFilename(projectName: string, type: string): string {
    const date = new Date().toISOString().split("T")[0];
    const cleanProject = projectName.replace(/[^a-zA-Z0-9]/g, "_");
    const cleanType = type.replace(/[^a-zA-Z0-9]/g, "_");
    return `${date}_${cleanProject}_${cleanType}.md`;
  }

  /**
   * Detect if content is a technical plan based on keywords
   */
  private isTechnicalPlan(content: string): boolean {
    const keywords = [
      "plan",
      "architecture",
      "design",
      "implementation",
      "technical",
      "system",
    ];
    const lowerContent = content.toLowerCase();
    return keywords.some((keyword) => lowerContent.includes(keyword));
  }

  /**
   * Create a new technical plan in the Inbox
   */
  async createTechnicalPlan(
    content: string,
    metadata: Partial<TechnicalPlanMetadata>,
  ): Promise<string> {
    const fullMetadata: TechnicalPlanMetadata = {
      created: new Date().toISOString().split("T")[0],
      source: metadata.source || "Other LLM",
      type: metadata.type || "Design",
      project: metadata.project || "Unnamed Project",
      priority: metadata.priority || "Medium",
      ...metadata,
    };

    const filename = this.generateFilename(
      fullMetadata.project,
      fullMetadata.type,
    );
    const filepath = `${this.folders.inbox}/${filename}`;

    const frontmatter = this.generateFrontmatter(fullMetadata);
    const fullContent = frontmatter + content;

    await this.apiClient.createOrUpdateFile(filepath, fullContent);
    return filepath;
  }

  /**
   * Move a plan between folders
   */
  async movePlan(
    filename: string,
    targetFolder: "inbox" | "reviewed" | "archive",
  ): Promise<boolean> {
    try {
      // Find the file in any of the folders
      let sourcePath: string | null = null;
      let content: string | null = null;

      for (const [_key, folder] of Object.entries(this.folders)) {
        const testPath = `${folder}/${filename}`;
        try {
          content = await this.apiClient.getFile(testPath);
          sourcePath = testPath;
          break;
        } catch {
          // File not in this folder, continue
        }
      }

      if (!sourcePath || !content) {
        throw new Error(`File ${filename} not found in Technical Plans`);
      }

      // Create file in target folder
      const targetPath = `${this.folders[targetFolder]}/${filename}`;
      await this.apiClient.createOrUpdateFile(targetPath, content);

      // Delete from source
      await this.apiClient.deleteFile(sourcePath);

      return true;
    } catch (error) {
      throw new Error(`Failed to move plan: ${error}`);
    }
  }

  /**
   * Mark a plan as reviewed (move to Reviewed folder and add review_date)
   */
  async markReviewed(filename: string): Promise<boolean> {
    try {
      // Get the file content
      const inboxPath = `${this.folders.inbox}/${filename}`;
      const content = await this.apiClient.getFile(inboxPath);

      // Parse and update metadata
      const { metadata, content: mainContent } = this.parseFrontmatter(content);
      metadata.review_date = new Date().toISOString().split("T")[0];

      // Generate new content with updated metadata
      const frontmatter = this.generateFrontmatter(metadata);
      const updatedContent = frontmatter + mainContent;

      // Create in Reviewed folder
      const reviewedPath = `${this.folders.reviewed}/${filename}`;
      await this.apiClient.createOrUpdateFile(reviewedPath, updatedContent);

      // Delete from Inbox
      await this.apiClient.deleteFile(inboxPath);

      return true;
    } catch (error) {
      throw new Error(`Failed to mark plan as reviewed: ${error}`);
    }
  }

  /**
   * Archive a plan
   */
  async archivePlan(filename: string): Promise<boolean> {
    // Find which folder the file is in
    for (const [key, folder] of Object.entries(this.folders)) {
      if (key === "archive") continue;

      try {
        const sourcePath = `${folder}/${filename}`;
        const content = await this.apiClient.getFile(sourcePath);

        // Move to archive
        const archivePath = `${this.folders.archive}/${filename}`;
        await this.apiClient.createOrUpdateFile(archivePath, content);
        await this.apiClient.deleteFile(sourcePath);

        return true;
      } catch {
        // File not in this folder, continue
      }
    }

    throw new Error(`File ${filename} not found in Technical Plans`);
  }

  /**
   * List technical plans in a specific folder
   */
  async listTechnicalPlans(
    folder?: "inbox" | "reviewed" | "archive",
  ): Promise<FileInfo[]> {
    const folders = folder
      ? [this.folders[folder]]
      : Object.values(this.folders);

    const technicalPlans: FileInfo[] = [];

    for (const folderPath of folders) {
      try {
        // Get directory contents by calling getFile on directory path
        const dirContentStr = await this.apiClient.getFile(folderPath + "/");
        const dirContent = JSON.parse(dirContentStr);

        if (dirContent.files && Array.isArray(dirContent.files)) {
          // Filter for .md files (exclude .gitkeep and other non-markdown files)
          const mdFiles = dirContent.files.filter((filename: string) =>
            filename.endsWith(".md")
          );

          for (const filename of mdFiles) {
            const filepath = `${folderPath}/${filename}`;
            try {
              const content = await this.apiClient.getFile(filepath);
              const { metadata } = this.parseFrontmatter(content);
              technicalPlans.push({
                path: filepath,
                metadata: metadata as TechnicalPlanMetadata,
              });
            } catch {
              // If we can't read the file, still include it without metadata
              technicalPlans.push({ path: filepath });
            }
          }
        }
      } catch {
        // Directory doesn't exist or can't be read, skip it silently
        // This is expected for directories that haven't been created yet
      }
    }

    return technicalPlans;
  }

  /**
   * Get metadata for a specific plan
   */
  async getPlanMetadata(
    filename: string,
  ): Promise<TechnicalPlanMetadata | null> {
    for (const folder of Object.values(this.folders)) {
      try {
        const filepath = `${folder}/${filename}`;
        const content = await this.apiClient.getFile(filepath);
        const { metadata } = this.parseFrontmatter(content);
        return metadata as TechnicalPlanMetadata;
      } catch {
        // File not in this folder, continue
      }
    }

    return null;
  }

  /**
   * Archive old reviewed plans
   */
  async archiveOldReviewed(daysOld: number): Promise<number> {
    const reviewedPlans = await this.listTechnicalPlans("reviewed");
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - daysOld);

    let archivedCount = 0;

    for (const plan of reviewedPlans) {
      if (plan.metadata?.review_date) {
        const reviewDate = new Date(plan.metadata.review_date);
        if (reviewDate < cutoffDate) {
          const filename = plan.path.split("/").pop()!;
          await this.archivePlan(filename);
          archivedCount++;
        }
      }
    }

    return archivedCount;
  }

  /**
   * Enhanced put file that detects and routes technical plans
   */
  async putFileEnhanced(path: string, content: string): Promise<void> {
    // Check if this should be a technical plan
    if (this.isTechnicalPlan(content) && !path.startsWith(this.basePath)) {
      // Extract metadata from content or use defaults
      const metadata: Partial<TechnicalPlanMetadata> = {
        source: "Other LLM",
        type: "Design",
        project: path.split("/").pop()?.replace(".md", "") || "Unnamed",
        priority: "Medium",
      };

      // Create as technical plan
      await this.createTechnicalPlan(content, metadata);
    } else {
      // Normal file creation
      await this.apiClient.createOrUpdateFile(path, content);
    }
  }
}
