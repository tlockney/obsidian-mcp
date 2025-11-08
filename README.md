# Obsidian MCP Server

A Model Context Protocol (MCP) server that enables AI models to interact with Obsidian vaults through the Obsidian Local REST API plugin.

There are other implementations of this that follow a very similar pattern. I built this solely to scratch an itch: as much as anything, I just wanted to see what building an MCP looked like. I also wanted to use Deno for this task. A nice side-effect is that it can provide binary builds.

As I've used this, I also found myself following a certain pattern with LLM's: I'd work through some scenario or challenge with them and then have a markdown plan produced for review. This might even end up being fed into another LLM for implementation. More and more, I found myself copying these documents to Obsidian for review and editing. So this MCP has evolved to support that workflow. It has become very particular to my usage and likely isn't of much value to anyone else other than as a curiosity.

## Quick Start

### Quick Install (Recommended)

Install the latest release with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/tlockney/obsidian-mcp/main/install.sh | sh
```

This will:
- Auto-detect your platform (Linux, macOS, Windows)
- Download the latest release binary
- Install to `~/.local/bin` (or `~/bin` on Windows)
- Remove macOS quarantine attributes automatically
- Make the binary executable and ready to use

### Manual Setup

1. **Install Prerequisites:**
   - [Obsidian](https://obsidian.md/) with [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api)
   - [Deno 2.x](https://deno.com/) (for development) or use pre-built binaries

2. **Download and Configure:**

   ```bash
   git clone https://github.com/tlockney/obsidian-mcp.git
   cd obsidian-mcp
   cp .env.example .env
   ```

3. **Set your API credentials in `.env`:**

   ```bash
   OBSIDIAN_API_URL=http://localhost:27123
   OBSIDIAN_API_KEY=your-api-key-from-obsidian
   ```

4. **Run and configure:**

   ```bash
   # See all options
   ./obsidian-mcp-binary --help

   # Run with custom settings
   ./obsidian-mcp-binary --api-url http://localhost:27123 --api-key your-key
   ```

5. **Add to your MCP client** (e.g., Claude Desktop) - see [Claude Desktop Setup](#claude-desktop-setup) below.

## Available Tools

### Core File Operations

- **`ping`**: Test connectivity to Obsidian
- **`list_files`**: List all files in your vault
- **`get_file`**: Read a specific file
- **`put_file`**: Create or update a file
- **`patch_file`**: Partially update a file
- **`delete_file`**: Delete a file

### Active Note Operations

- **`get_active`**: Get the currently active note
- **`replace_active`**: Replace active note content
- **`patch_active`**: Update active note content
- **`append_active`**: Append to active note

### Obsidian Commands

- **`list_commands`**: List available Obsidian commands
- **`execute_command`**: Execute an Obsidian command

### Technical Plans Management

- **`create_technical_plan`**: Create a new technical plan with metadata in the Inbox
- **`mark_plan_reviewed`**: Mark a plan as reviewed (moves from Inbox to Reviewed)
- **`archive_plan`**: Archive a technical plan
- **`list_technical_plans`**: List technical plans, optionally filtered by folder
- **`get_plan_metadata`**: Get metadata for a specific technical plan
- **`archive_old_reviewed_plans`**: Archive reviewed plans older than specified days

The Technical Plans Management tools provide automated workflow management for AI-generated technical documentation, with organized folder structure (Inbox/Reviewed/Archive), frontmatter metadata, and lifecycle management.

## Setup Guide

### Step 1: Configure Obsidian

1. Install the [Local REST API plugin](https://github.com/coddingtonbear/obsidian-local-rest-api) in Obsidian
2. Enable the plugin in Settings → Community Plugins
3. Configure the plugin's API key (Settings → Local REST API → Settings)
4. Note the port number (default: 27123)

### Step 2: Install the MCP Server

**Option A: Quick Install Script** (Recommended)

Install with a single command:

```bash
curl -fsSL https://raw.githubusercontent.com/tlockney/obsidian-mcp/main/install.sh | sh
```

This automatically handles platform detection, binary download, and macOS quarantine removal.

**Option B: Manual Binary Installation**

1. **Download the latest release for your platform from the [Releases page](https://github.com/tlockney/obsidian-mcp/releases)**

2. **Extract the binary:**

   ```bash
   # For Linux/macOS .tar.gz files
   tar -xzf obsidian-mcp-*.tar.gz

   # For Windows/macOS .zip files
   unzip obsidian-mcp-*.zip
   ```

3. **On macOS: Handle security warning**

   macOS will flag the unsigned binary as a security risk. To allow it:

   **Method 1: Using System Preferences** (Recommended)
   - Try to run the binary: `./obsidian-mcp-mac-arm64`
   - macOS will show a security dialog
   - Go to **System Preferences** → **Security & Privacy** → **General**
   - Click **"Allow Anyway"** next to the blocked app message
   - Run the binary again and click **"Open"** when prompted

   **Method 2: Using Terminal** (Advanced)

   ```bash
   # Remove quarantine attribute
   xattr -d com.apple.quarantine obsidian-mcp-mac-arm64

   # Make executable (if needed)
   chmod +x obsidian-mcp-mac-arm64
   ```

   **Method 3: System Settings** (macOS 13+)
   - Go to **Apple Menu** → **System Settings** → **Privacy & Security**
   - Scroll down to **Security** section
   - Click **"Allow Anyway"** next to the blocked app

**Option C: Build from Source**

```bash
git clone https://github.com/yourusername/obsidian-mcp.git
cd obsidian-mcp
deno task build-mac  # or build-linux-x86_64, build-windows-x86_64
```

### Step 3: Configure the Server

You can configure the server using CLI arguments, environment variables, or a `.env` file:

**Option A: CLI Arguments** (Recommended)

```bash
# Show help and all options
obsidian-mcp --help

# Use default settings
obsidian-mcp

# Custom configuration
obsidian-mcp --api-url http://localhost:27123 --api-key your-api-key

# Short options
obsidian-mcp -u http://localhost:8080 -k your-key
```

**Option B: Environment Variables**

```bash
export OBSIDIAN_API_URL=http://localhost:27123
export OBSIDIAN_API_KEY=your-api-key
obsidian-mcp
```

**Option C: .env File**

```bash
# Create .env file
OBSIDIAN_API_URL=http://localhost:27123
OBSIDIAN_API_KEY=your-api-key
```

**Configuration Priority:** CLI arguments > Environment variables > Default values

## Claude Desktop Setup

1. **Locate your Claude Desktop config file:**
   - macOS: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - Windows: `%APPDATA%\Claude\claude_desktop_config.json`
   - Linux: `~/.config/Claude/claude_desktop_config.json`

2. **Add the MCP server configuration:**

   **Option A: Using CLI Arguments** (Recommended)

   If you used the quick install script, the binary will be at:
   - macOS/Linux: `~/.local/bin/obsidian-mcp-{platform}`
   - Windows: `~/bin/obsidian-mcp-windows-x86_64.exe`

   ```json
   {
     "mcpServers": {
       "obsidian": {
         "command": "/Users/yourusername/.local/bin/obsidian-mcp-mac-arm64",
         "args": [
           "--api-url",
           "http://localhost:27123",
           "--api-key",
           "your-api-key"
         ]
       }
     }
   }
   ```

   **Option B: Using Environment Variables**

   ```json
   {
     "mcpServers": {
       "obsidian": {
         "command": "/Users/yourusername/.local/bin/obsidian-mcp-mac-arm64",
         "env": {
           "OBSIDIAN_API_URL": "http://localhost:27123",
           "OBSIDIAN_API_KEY": "your-api-key"
         }
       }
     }
   }
   ```

3. **Restart Claude Desktop**

### Using with Deno Runtime

Instead of a binary, you can run directly with Deno:

**With CLI Arguments:**

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net",
        "--allow-env",
        "--allow-read",
        "/path/to/obsidian-mcp/src/main.ts",
        "--api-url",
        "http://localhost:27123",
        "--api-key",
        "your-api-key"
      ]
    }
  }
}
```

**With Environment Variables:**

```json
{
  "mcpServers": {
    "obsidian": {
      "command": "deno",
      "args": [
        "run",
        "--allow-net",
        "--allow-env",
        "--allow-read",
        "/path/to/obsidian-mcp/src/main.ts"
      ],
      "env": {
        "OBSIDIAN_API_URL": "http://localhost:27123",
        "OBSIDIAN_API_KEY": "your-api-key"
      }
    }
  }
}
```

## Troubleshooting

**Get Help:**

```bash
obsidian-mcp --help  # Shows all available options and examples
```

**macOS Security Issues:**

If macOS blocks the binary with "cannot be opened because it is from an unidentified developer":

- See the [macOS security instructions](#step-2-install-the-mcp-server) above
- Or use: `xattr -d com.apple.quarantine obsidian-mcp-mac-arm64`

**Connection Issues:**

- Ensure Obsidian is running with the Local REST API plugin enabled
- Check the port number matches your configuration
- Test the API directly: `curl -H "Authorization: Bearer your-api-key" http://localhost:27123/`

**Authentication Errors:**

- Verify your API key matches the one in Obsidian's plugin settings
- Try without an API key if the plugin doesn't require one

**Testing the Server:**

```bash
# Test with CLI arguments
./obsidian-mcp-binary --api-url http://localhost:27123 --api-key your-key

# Test with environment variables
export OBSIDIAN_API_URL="http://localhost:27123"
export OBSIDIAN_API_KEY="your-api-key"
echo '{}' | ./obsidian-mcp-binary
```

## Contributing

### Development Setup

1. **Clone and install dependencies:**

   ```bash
   git clone https://github.com/yourusername/obsidian-mcp.git
   cd obsidian-mcp
   ```

2. **Run in development mode:**

   ```bash
   deno task dev
   ```

### Available Commands

- `deno task dev` - Run with hot reloading
- `deno test` - Run tests
- `deno fmt` - Format code
- `deno lint` - Lint code
- `deno task build-mac` - Build macOS binary
- `deno task build-linux-x86_64` - Build Linux x86_64 binary
- `deno task build-windows-x86_64` - Build Windows binary

## Releasing

This project uses automated GitHub workflows to build and release cross-platform binaries. Here's how to create a new release:

### Release Process

1. **Update the version number** in `deno.json`:
   ```json
   {
     "version": "0.4.0"
     // ... rest of config
   }
   ```

2. **Commit the version bump:**
   ```bash
   git add deno.json
   git commit -m "chore: bump version to 0.4.0"
   git push
   ```

3. **Create and push a git tag:**
   ```bash
   # Create an annotated tag
   git tag -a v0.4.0 -m "Release v0.4.0"

   # Push the tag to trigger the release workflow
   git push origin v0.4.0
   ```

4. **GitHub Actions will automatically:**
   - Build cross-platform binaries for:
     - macOS (Intel and Apple Silicon)
     - Linux (x86_64 and ARM64)
     - Windows (x86_64)
   - Create a GitHub release with auto-generated release notes
   - Attach all binary artifacts to the release

### Supported Platforms

The release workflow builds binaries for these platforms:

| Platform | Architecture          | Binary Name                       |
| -------- | --------------------- | --------------------------------- |
| macOS    | Intel (x86_64)        | `obsidian-mcp-mac-x86_64`         |
| macOS    | Apple Silicon (ARM64) | `obsidian-mcp-mac-arm64`          |
| Linux    | x86_64                | `obsidian-mcp-linux-x86_64`       |
| Linux    | ARM64                 | `obsidian-mcp-linux-arm64`        |
| Windows  | x86_64                | `obsidian-mcp-windows-x86_64.exe` |

### Manual Release (Emergency)

If you need to trigger a release manually without creating a tag:

1. Go to **Actions** → **Build and Release** in the GitHub repository
2. Click **Run workflow**
3. Select the branch and click **Run workflow**

This will build the binaries but won't create a GitHub release (only tag-triggered runs create releases).

### Version Synchronization

**Important:** The version in `deno.json` must match the git tag version for the release to work correctly. The workflow extracts the version from `deno.json` and uses it for:

- Binary filenames (`obsidian-mcp-*-v0.4.0.tar.gz`)
- Artifact naming
- Release naming

### Pre-release Testing

Before creating a release tag, test the build process locally:

```bash
# Test local builds for different platforms
deno task build-mac
deno task build-linux-x86_64
deno task build-windows-x86_64

# Test the binaries
./build/obsidian-mcp-mac --help
```

### Release Notes

GitHub automatically generates release notes based on:

- Commit messages since the last release
- Pull request titles and descriptions
- Contributor information

For better release notes, use conventional commit messages:

- `feat:` for new features
- `fix:` for bug fixes
- `docs:` for documentation changes
- `chore:` for maintenance tasks

## License

MIT
