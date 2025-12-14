#!/usr/bin/env -S deno run --allow-read --allow-write --allow-run

import { parseArgs } from "@std/cli/parse-args";

interface VersionBumpOptions {
  type: "major" | "minor" | "patch";
  dryRun?: boolean;
  noGit?: boolean;
}

function parseVersion(versionString: string): [number, number, number] {
  const match = versionString.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${versionString}`);
  }
  return [parseInt(match[1]), parseInt(match[2]), parseInt(match[3])];
}

function incrementVersion(
  version: [number, number, number],
  type: "major" | "minor" | "patch",
): [number, number, number] {
  const [major, minor, patch] = version;
  switch (type) {
    case "major":
      return [major + 1, 0, 0];
    case "minor":
      return [major, minor + 1, 0];
    case "patch":
      return [major, minor, patch + 1];
  }
}

function formatVersion(version: [number, number, number]): string {
  return `${version[0]}.${version[1]}.${version[2]}`;
}

async function updateDenoJson(newVersion: string): Promise<void> {
  const denoJsonPath = "deno.json";
  const content = await Deno.readTextFile(denoJsonPath);
  const denoConfig = JSON.parse(content);

  const oldVersion = denoConfig.version;
  denoConfig.version = newVersion;

  await Deno.writeTextFile(
    denoJsonPath,
    JSON.stringify(denoConfig, null, 2) + "\n",
  );

  console.log(`✓ Updated ${denoJsonPath}: ${oldVersion} → ${newVersion}`);
}

async function updateMainTs(newVersion: string): Promise<void> {
  const mainTsPath = "src/main.ts";
  const content = await Deno.readTextFile(mainTsPath);

  // Find and replace the version in the McpServer constructor
  const versionRegex = /(\s+version:\s*")([^"]+)(")/;
  const match = content.match(versionRegex);

  if (!match) {
    throw new Error("Could not find version in src/main.ts");
  }

  const oldVersion = match[2];
  const updatedContent = content.replace(versionRegex, `$1${newVersion}$3`);

  await Deno.writeTextFile(mainTsPath, updatedContent);

  console.log(`✓ Updated ${mainTsPath}: ${oldVersion} → ${newVersion}`);
}

async function updateCliTs(newVersion: string): Promise<void> {
  const cliTsPath = "src/cli.ts";
  const content = await Deno.readTextFile(cliTsPath);

  // Find and replace the VERSION constant
  const versionRegex = /(export const VERSION = ")([^"]+)(")/;
  const match = content.match(versionRegex);

  if (!match) {
    throw new Error("Could not find VERSION constant in src/cli.ts");
  }

  const oldVersion = match[2];
  const updatedContent = content.replace(versionRegex, `$1${newVersion}$3`);

  await Deno.writeTextFile(cliTsPath, updatedContent);

  console.log(`✓ Updated ${cliTsPath}: ${oldVersion} → ${newVersion}`);
}

async function runCommand(command: string, args: string[]): Promise<void> {
  const process = new Deno.Command(command, { args });
  const result = await process.output();

  if (!result.success) {
    const error = new TextDecoder().decode(result.stderr);
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${error}`);
  }
}

async function commitAndTag(version: string): Promise<void> {
  // Add all changes
  await runCommand("git", ["add", "deno.json", "src/main.ts", "src/cli.ts"]);

  // Commit with version message
  await runCommand("git", [
    "commit",
    "-m",
    `chore: bump version to ${version}`,
  ]);

  // Create tag
  const tagName = `v${version}`;
  await runCommand("git", ["tag", tagName]);

  console.log(`✓ Committed changes and created tag ${tagName}`);
}

function showHelp(): void {
  console.log(`
Version Bump Script

Usage:
  deno task version-bump <type>
  deno task version-bump <type> --dry-run
  deno task version-bump <type> --no-git

Arguments:
  type        Version increment type: major, minor, or patch

Options:
  --dry-run   Show what would be changed without making changes
  --no-git    Update files only, skip git commit and tag (for CI use)
  --help      Show this help message

Examples:
  deno task version-bump patch          # 1.0.0 → 1.0.1
  deno task version-bump minor          # 1.0.1 → 1.1.0
  deno task version-bump major          # 1.1.0 → 2.0.0
  deno task version-bump patch --dry-run
  deno task version-bump patch --no-git # CI mode: update files only
`);
}

async function main(): Promise<void> {
  const args = parseArgs(Deno.args, {
    boolean: ["dry-run", "no-git", "help"],
    string: ["_"],
  });

  if (args.help) {
    showHelp();
    return;
  }

  const type = args._[0] as string;
  if (!type || !["major", "minor", "patch"].includes(type)) {
    console.error("Error: Must specify version type (major, minor, or patch)");
    showHelp();
    Deno.exit(1);
  }

  const options: VersionBumpOptions = {
    type: type as "major" | "minor" | "patch",
    dryRun: args["dry-run"],
    noGit: args["no-git"],
  };

  try {
    // Read current version from deno.json
    const denoJsonContent = await Deno.readTextFile("deno.json");
    const denoConfig = JSON.parse(denoJsonContent);
    const currentVersion = parseVersion(denoConfig.version);
    const newVersion = incrementVersion(currentVersion, options.type);
    const newVersionString = formatVersion(newVersion);

    console.log(
      `Version bump: ${formatVersion(currentVersion)} → ${newVersionString}`,
    );

    if (options.dryRun) {
      console.log("\n🔍 Dry run - no changes will be made");
      console.log(`Would update deno.json version to: ${newVersionString}`);
      console.log(`Would update src/main.ts version to: ${newVersionString}`);
      console.log(`Would update src/cli.ts version to: ${newVersionString}`);
      if (!options.noGit) {
        console.log(
          `Would commit changes and create tag: v${newVersionString}`,
        );
      }
      return;
    }

    // Skip git checks if --no-git is used (CI mode)
    if (!options.noGit) {
      // Ensure we're in a git repository and working tree is clean
      try {
        const gitStatus = new Deno.Command("git", {
          args: ["status", "--porcelain"],
        });
        const result = await gitStatus.output();
        const output = new TextDecoder().decode(result.stdout);

        if (output.trim().length > 0) {
          console.error(
            "Error: Working directory is not clean. Please commit or stash changes first.",
          );
          Deno.exit(1);
        }
      } catch {
        console.error("Error: Not in a git repository");
        Deno.exit(1);
      }
    }

    // Update files
    await updateDenoJson(newVersionString);
    await updateMainTs(newVersionString);
    await updateCliTs(newVersionString);

    // Skip tests and linting if --no-git is used (CI runs these separately)
    if (!options.noGit) {
      // Run tests to ensure everything still works
      console.log("🧪 Running tests...");
      await runCommand("deno", ["task", "test"]);
      console.log("✓ Tests passed");

      // Run formatting and linting
      console.log("🎨 Formatting and linting...");
      await runCommand("deno", ["fmt"]);
      await runCommand("deno", ["lint"]);
      console.log("✓ Code formatted and linted");

      // Commit and tag
      await commitAndTag(newVersionString);

      console.log(`\n🎉 Successfully bumped version to ${newVersionString}`);
      console.log("\nNext steps:");
      console.log("  git push");
      console.log(`  git push origin v${newVersionString}`);
    } else {
      console.log(`\n✓ Version files updated to ${newVersionString}`);
    }
  } catch (error) {
    console.error(
      `Error: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
    Deno.exit(1);
  }
}

if (import.meta.main) {
  await main();
}
