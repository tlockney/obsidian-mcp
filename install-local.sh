#!/bin/bash
set -e

# Obsidian MCP Server Installation Script
REPO="tlockney/obsidian-mcp"
INSTALL_DIR="$HOME/.local/bin"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}🔽 Installing Obsidian MCP Server${NC}"

# Detect platform and architecture
detect_platform() {
    local os=$(uname -s)
    local arch=$(uname -m)

    case "$os" in
        "Linux")
            case "$arch" in
                "x86_64"|"amd64") echo "linux-x86_64" ;;
                "arm64"|"aarch64") echo "linux-arm64" ;;
                *) echo "Error: Unsupported Linux architecture: $arch" >&2; exit 1 ;;
            esac
            ;;
        "Darwin")
            case "$arch" in
                "arm64") echo "mac-arm64" ;;
                "x86_64") echo "mac-x86_64" ;;
                *) echo "Error: Unsupported macOS architecture: $arch" >&2; exit 1 ;;
            esac
            ;;
        CYGWIN*|MINGW*|MSYS*)
            case "$arch" in
                "x86_64"|"amd64") echo "windows-x86_64" ;;
                *) echo "Error: Unsupported Windows architecture: $arch" >&2; exit 1 ;;
            esac
            ;;
        *)
            echo "Error: Unsupported OS: $os" >&2
            echo "Supported: Linux (x86_64, ARM64), macOS (Intel, Apple Silicon), Windows (x86_64)" >&2
            exit 1
            ;;
    esac
}

PLATFORM=$(detect_platform)
echo -e "${GREEN}✓ Detected platform: $PLATFORM${NC}"

# Set platform-specific variables
case "$PLATFORM" in
    linux-*) ARCHIVE_EXT="tar.gz" ;;
    windows-*)
        ARCHIVE_EXT="zip"
        INSTALL_DIR="$HOME/bin"
        ;;
    *) ARCHIVE_EXT="zip" ;;
esac

# Binary name includes platform suffix
BINARY_NAME="obsidian-mcp-$PLATFORM"
if [[ "$PLATFORM" == "windows-"* ]]; then
    BINARY_NAME="$BINARY_NAME.exe"
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Get latest release
echo -e "${BLUE}📡 Fetching latest release...${NC}"
RELEASE_INFO=$(curl -s --max-time 10 "https://api.github.com/repos/$REPO/releases/latest")
if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Failed to fetch release information${NC}"
    exit 1
fi

VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name":' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep '"browser_download_url":' | grep "obsidian-mcp-$PLATFORM.*\.$ARCHIVE_EXT" | head -1 | sed -E 's/.*"browser_download_url": *"([^"]+)".*/\1/')

if [[ -z "$VERSION" ]] || [[ -z "$DOWNLOAD_URL" ]]; then
    echo -e "${RED}❌ Could not find release for $PLATFORM${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Found version: $VERSION${NC}"

# Download and extract
TEMP_DIR=$(mktemp -d)
TEMP_FILE="$TEMP_DIR/release.$ARCHIVE_EXT"

echo -e "${BLUE}📦 Downloading release...${NC}"
curl -L --max-time 60 -o "$TEMP_FILE" "$DOWNLOAD_URL"
if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Download failed${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo -e "${BLUE}📂 Extracting...${NC}"
cd "$TEMP_DIR"
case "$ARCHIVE_EXT" in
    "zip") unzip -q "release.$ARCHIVE_EXT" ;;
    "tar.gz") tar -xzf "release.$ARCHIVE_EXT" ;;
esac

# Find the extracted binary
EXTRACTED_BINARY=""
for candidate in obsidian-mcp-$PLATFORM* obsidian-mcp*; do
    if [[ -f "$candidate" && -x "$candidate" ]]; then
        EXTRACTED_BINARY="$candidate"
        break
    fi
done

if [[ -z "$EXTRACTED_BINARY" ]]; then
    echo -e "${RED}❌ Could not find binary in archive${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Remove macOS quarantine attribute to prevent security warnings
if [[ "$(uname -s)" == "Darwin" ]]; then
    echo -e "${BLUE}🔓 Removing macOS quarantine attribute...${NC}"
    xattr -dr com.apple.quarantine "$EXTRACTED_BINARY" 2>/dev/null || true
fi

# Install binary
echo -e "${BLUE}🚀 Installing to $INSTALL_DIR/$BINARY_NAME${NC}"
cp "$EXTRACTED_BINARY" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Cleanup
rm -rf "$TEMP_DIR"

echo -e "${GREEN}✅ Installation successful!${NC}"

# Check PATH
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
    echo -e "${YELLOW}⚠️  $INSTALL_DIR is not in your PATH${NC}"
    case "$(uname -s)" in
        "Darwin") SHELL_RC="~/.zshrc" ;;
        CYGWIN*|MINGW*|MSYS*) SHELL_RC="~/.bashrc" ;;
        *) SHELL_RC="~/.bashrc" ;;
    esac
    echo "Add to your $SHELL_RC:"
    echo -e "${GREEN}export PATH=\"$INSTALL_DIR:\$PATH\"${NC}"
    echo "Then run: source $SHELL_RC"
else
    echo -e "${GREEN}✓ Ready to use: ${BINARY_NAME}${NC}"
fi

echo
echo -e "${BLUE}Test installation:${NC}"
echo "$INSTALL_DIR/$BINARY_NAME --help"
