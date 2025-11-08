#!/bin/sh
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

printf "${BLUE}🔽 Installing Obsidian MCP Server${NC}\n"

# Detect platform and architecture
detect_platform() {
    os=$(uname -s)
    arch=$(uname -m)

    case "$os" in
        "Linux")
            case "$arch" in
                "x86_64"|"amd64") echo "linux-x86_64" ;;
                "arm64"|"aarch64") echo "linux-arm64" ;;
                *) printf "Error: Unsupported Linux architecture: %s\n" "$arch" >&2; exit 1 ;;
            esac
            ;;
        "Darwin")
            case "$arch" in
                "arm64") echo "mac-arm64" ;;
                "x86_64") echo "mac-x86_64" ;;
                *) printf "Error: Unsupported macOS architecture: %s\n" "$arch" >&2; exit 1 ;;
            esac
            ;;
        CYGWIN*|MINGW*|MSYS*)
            case "$arch" in
                "x86_64"|"amd64") echo "windows-x86_64" ;;
                *) printf "Error: Unsupported Windows architecture: %s\n" "$arch" >&2; exit 1 ;;
            esac
            ;;
        *)
            printf "Error: Unsupported OS: %s\n" "$os" >&2
            printf "Supported: Linux (x86_64, ARM64), macOS (Intel, Apple Silicon), Windows (x86_64)\n" >&2
            exit 1
            ;;
    esac
}

PLATFORM=$(detect_platform)
printf "${GREEN}✓ Detected platform: %s${NC}\n" "$PLATFORM"

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
case "$PLATFORM" in
    windows-*)
        BINARY_NAME="$BINARY_NAME.exe"
        ;;
esac

# Create install directory
mkdir -p "$INSTALL_DIR"

# Get latest release
printf "${BLUE}📡 Fetching latest release...${NC}\n"
RELEASE_INFO=$(curl -s --max-time 10 "https://api.github.com/repos/$REPO/releases/latest")
if [ $? -ne 0 ]; then
    printf "${RED}❌ Failed to fetch release information${NC}\n"
    exit 1
fi

VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name":' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')
DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep '"browser_download_url":' | grep "obsidian-mcp-$PLATFORM.*\.$ARCHIVE_EXT" | head -1 | sed -E 's/.*"browser_download_url": *"([^"]+)".*/\1/')

if [ -z "$VERSION" ] || [ -z "$DOWNLOAD_URL" ]; then
    printf "${RED}❌ Could not find release for %s${NC}\n" "$PLATFORM"
    exit 1
fi

printf "${GREEN}✓ Found version: %s${NC}\n" "$VERSION"

# Download and extract
TEMP_DIR=$(mktemp -d)
TEMP_FILE="$TEMP_DIR/release.$ARCHIVE_EXT"

printf "${BLUE}📦 Downloading release...${NC}\n"
curl -L --max-time 60 -o "$TEMP_FILE" "$DOWNLOAD_URL"
if [ $? -ne 0 ]; then
    printf "${RED}❌ Download failed${NC}\n"
    rm -rf "$TEMP_DIR"
    exit 1
fi

printf "${BLUE}📂 Extracting...${NC}\n"
cd "$TEMP_DIR"
case "$ARCHIVE_EXT" in
    "zip") unzip -q "release.$ARCHIVE_EXT" ;;
    "tar.gz") tar -xzf "release.$ARCHIVE_EXT" ;;
esac

# Find the extracted binary
EXTRACTED_BINARY=""
for candidate in obsidian-mcp-$PLATFORM* obsidian-mcp*; do
    if [ -f "$candidate" ] && [ -x "$candidate" ]; then
        EXTRACTED_BINARY="$candidate"
        break
    fi
done

if [ -z "$EXTRACTED_BINARY" ]; then
    printf "${RED}❌ Could not find binary in archive${NC}\n"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Remove macOS quarantine attribute to prevent security warnings
if [ "$(uname -s)" = "Darwin" ]; then
    printf "${BLUE}🔓 Removing macOS quarantine attribute...${NC}\n"
    xattr -dr com.apple.quarantine "$EXTRACTED_BINARY" 2>/dev/null || true
fi

# Install binary
printf "${BLUE}🚀 Installing to %s/%s${NC}\n" "$INSTALL_DIR" "$BINARY_NAME"
cp "$EXTRACTED_BINARY" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Cleanup
rm -rf "$TEMP_DIR"

printf "${GREEN}✅ Installation successful!${NC}\n"

# Check PATH
case ":$PATH:" in
    *":$INSTALL_DIR:"*)
        printf "${GREEN}✓ Ready to use: %s${NC}\n" "$BINARY_NAME"
        ;;
    *)
        printf "${YELLOW}⚠️  %s is not in your PATH${NC}\n" "$INSTALL_DIR"
        case "$(uname -s)" in
            "Darwin") SHELL_RC="~/.zshrc" ;;
            CYGWIN*|MINGW*|MSYS*) SHELL_RC="~/.bashrc" ;;
            *) SHELL_RC="~/.bashrc" ;;
        esac
        printf "Add to your %s:\n" "$SHELL_RC"
        printf "${GREEN}export PATH=\"%s:\$PATH\"${NC}\n" "$INSTALL_DIR"
        printf "Then run: source %s\n" "$SHELL_RC"
        ;;
esac

printf "\n"
printf "${BLUE}Test installation:${NC}\n"
printf "%s/%s --help\n" "$INSTALL_DIR" "$BINARY_NAME"
