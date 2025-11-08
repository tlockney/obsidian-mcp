# Local Installation for Testing

This directory contains a script to easily install the latest Obsidian MCP server release locally for testing.

## Quick Install

### Option 1: One-liner (recommended)

```bash
curl -fsSL https://raw.githubusercontent.com/tlockney/obsidian-mcp/main/install.sh | sh
```

### Option 2: Download and run locally

```bash
# Download the script
curl -O https://raw.githubusercontent.com/tlockney/obsidian-mcp/main/install.sh

# Make it executable and run
chmod +x install.sh
./install.sh
```

### Option 3: Use the local script (if you've cloned the repo)

```bash
# Make the script executable (first time only)
chmod +x install.sh

# Run the installation script
./install.sh
```

## What the Script Does

1. **Detects your Mac architecture** (Apple Silicon ARM64 or Intel x86_64)
2. **Fetches the latest release** from GitHub using the API
3. **Downloads the appropriate binary** for your platform
4. **Extracts and installs** it to `~/.local/bin/obsidian-mcp`
5. **Verifies the installation** by testing the binary
6. **Provides next steps** for PATH configuration if needed

## Manual Installation

If you prefer to install manually:

1. Go to the [Releases page](https://github.com/tlockney/obsidian-mcp/releases)
2. Download the appropriate file for your platform:
   - Apple Silicon: `obsidian-mcp-mac-arm64-vX.X.X.zip`
   - Intel Mac: `obsidian-mcp-mac-x86_64-vX.X.X.zip`
3. Extract the binary
4. Move it to `~/.local/bin/` and make it executable:

```bash
# Create directory if it doesn't exist
mkdir -p ~/.local/bin

# Move and make executable (adjust filename as needed)
mv obsidian-mcp-mac-arm64 ~/.local/bin/obsidian-mcp
chmod +x ~/.local/bin/obsidian-mcp
```

## PATH Configuration

If `~/.local/bin` is not in your PATH, add this to your shell profile:

**For zsh (default on macOS):**

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**For bash:**

```bash
echo 'export PATH="$HOME/.local/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

## Testing the Installation

Once installed, test with:

```bash
obsidian-mcp --help
obsidian-mcp --version
```

## Usage for Development

With the binary in your PATH, you can easily test the MCP server:

```bash
# Test with your Obsidian setup
obsidian-mcp --api-url http://localhost:27123 --api-key your-api-key

# Or use environment variables
export OBSIDIAN_API_URL="http://localhost:27123"
export OBSIDIAN_API_KEY="your-api-key"
obsidian-mcp
```

## Updating

Simply run the installation script again to get the latest version:

```bash
./install.sh
```

The script will detect if a version is already installed and update it.
