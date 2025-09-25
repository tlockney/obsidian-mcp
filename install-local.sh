#!/bin/bash
set -e

# Obsidian MCP Server Multi-Platform Installation Script
# Downloads the latest release for the detected platform and installs it

REPO="tlockney/obsidian-mcp"
BINARY_NAME="obsidian-mcp"

# Set platform-specific defaults
case "$(uname -s)" in
    CYGWIN*|MINGW*|MSYS*)
        INSTALL_DIR="$HOME/bin"
        ;;
    *)
        INSTALL_DIR="$HOME/.local/bin"
        ;;
esac

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🔽 Obsidian MCP Server - Multi-Platform Installation${NC}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

# Detect platform and architecture
detect_platform() {
    local os
    local arch
    local platform

    os=$(uname -s)
    arch=$(uname -m)

    case "$os" in
        "Linux")
            case "$arch" in
                "x86_64"|"amd64")
                    platform="linux-x86_64"
                    ;;
                "arm64"|"aarch64")
                    platform="linux-arm64"
                    ;;
                *)
                    echo -e "${RED}❌ Error: Unsupported Linux architecture: $arch${NC}"
                    exit 1
                    ;;
            esac
            ;;
        "Darwin")
            case "$arch" in
                "arm64")
                    platform="mac-arm64"
                    ;;
                "x86_64")
                    platform="mac-x86_64"
                    ;;
                *)
                    echo -e "${RED}❌ Error: Unsupported macOS architecture: $arch${NC}"
                    exit 1
                    ;;
            esac
            ;;
        CYGWIN*|MINGW*|MSYS*)
            case "$arch" in
                "x86_64"|"amd64")
                    platform="windows-x86_64"
                    BINARY_NAME="obsidian-mcp.exe"
                    ;;
                *)
                    echo -e "${RED}❌ Error: Unsupported Windows architecture: $arch${NC}"
                    exit 1
                    ;;
            esac
            ;;
        *)
            echo -e "${RED}❌ Error: Unsupported operating system: $os${NC}"
            echo "Supported platforms:"
            echo "  - Linux (x86_64, ARM64)"
            echo "  - macOS (Intel x86_64, Apple Silicon ARM64)"
            echo "  - Windows (x86_64)"
            exit 1
            ;;
    esac

    echo "$platform"
}

PLATFORM=$(detect_platform)

case "$PLATFORM" in
    "mac-arm64")
        echo -e "${GREEN}✓ Detected: Apple Silicon Mac (ARM64)${NC}"
        ;;
    "mac-x86_64")
        echo -e "${GREEN}✓ Detected: Intel Mac (x86_64)${NC}"
        ;;
    "linux-x86_64")
        echo -e "${GREEN}✓ Detected: Linux x86_64${NC}"
        ;;
    "linux-arm64")
        echo -e "${GREEN}✓ Detected: Linux ARM64${NC}"
        ;;
    "windows-x86_64")
        echo -e "${GREEN}✓ Detected: Windows x86_64${NC}"
        ;;
esac

# Create install directory if it doesn't exist
mkdir -p "$INSTALL_DIR"

# Get the latest release information
echo -e "${BLUE}📡 Fetching latest release information...${NC}"
RELEASE_INFO=$(curl -s "https://api.github.com/repos/$REPO/releases/latest")

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Error: Failed to fetch release information${NC}"
    exit 1
fi

# Extract version and download URL
VERSION=$(echo "$RELEASE_INFO" | grep '"tag_name":' | sed -E 's/.*"tag_name": *"([^"]+)".*/\1/')

# Determine archive extension based on platform
case "$PLATFORM" in
    linux-*)
        ARCHIVE_EXT="tar.gz"
        ;;
    *)
        ARCHIVE_EXT="zip"
        ;;
esac

DOWNLOAD_URL=$(echo "$RELEASE_INFO" | grep '"browser_download_url":' | grep "obsidian-mcp-$PLATFORM" | grep "\.$ARCHIVE_EXT" | head -1 | sed -E 's/.*"browser_download_url": *"([^"]+)".*/\1/')

if [[ -z "$VERSION" ]] || [[ -z "$DOWNLOAD_URL" ]]; then
    echo -e "${RED}❌ Error: Could not find release information for $PLATFORM${NC}"
    echo "Looking for: obsidian-mcp-$PLATFORM.*.$ARCHIVE_EXT"
    echo "Available assets:"
    echo "$RELEASE_INFO" | grep '"name":' | grep -E 'obsidian-mcp.*\.(zip|tar\.gz)' || echo "No matching archives found"
    exit 1
fi

echo -e "${GREEN}✓ Found version: $VERSION${NC}"
echo -e "${GREEN}✓ Download URL: $DOWNLOAD_URL${NC}"

# Check if binary already exists and get its version
EXISTING_VERSION=""
if [[ -f "$INSTALL_DIR/$BINARY_NAME" ]]; then
    EXISTING_VERSION=$("$INSTALL_DIR/$BINARY_NAME" --version 2>/dev/null | head -1 || echo "unknown")
    echo -e "${YELLOW}⚠️  Existing installation found: $EXISTING_VERSION${NC}"
fi

# Download the release
TEMP_DIR=$(mktemp -d)
ARCHIVE_NAME="obsidian-mcp-$PLATFORM-$VERSION.$ARCHIVE_EXT"
TEMP_FILE="$TEMP_DIR/$ARCHIVE_NAME"

echo -e "${BLUE}📦 Downloading $ARCHIVE_NAME...${NC}"
curl -L -o "$TEMP_FILE" "$DOWNLOAD_URL"

if [[ $? -ne 0 ]]; then
    echo -e "${RED}❌ Error: Download failed${NC}"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Extract the binary
echo -e "${BLUE}📂 Extracting binary...${NC}"
cd "$TEMP_DIR"

case "$ARCHIVE_EXT" in
    "zip")
        unzip -q "$ARCHIVE_NAME"
        ;;
    "tar.gz")
        tar -xzf "$ARCHIVE_NAME"
        ;;
    *)
        echo -e "${RED}❌ Error: Unsupported archive format: $ARCHIVE_EXT${NC}"
        rm -rf "$TEMP_DIR"
        exit 1
        ;;
esac

# Find the binary file (it might be named differently)
# Try different patterns based on platform and binary naming conventions
EXTRACTED_BINARY=""

# Define search patterns based on platform
if [[ "$PLATFORM" == "windows-"* ]]; then
    # Windows patterns - look for .exe files
    for pattern in "obsidian-mcp-$PLATFORM.exe" "obsidian-mcp.exe" "obsidian-mcp-windows-*.exe"; do
        EXTRACTED_BINARY=$(find . -name "$pattern" -type f | head -1)
        if [[ -n "$EXTRACTED_BINARY" ]]; then
            break
        fi
    done
else
    # Unix/Linux/macOS patterns - executable files without extension
    for pattern in "obsidian-mcp-$PLATFORM" "obsidian-mcp" "obsidian-mcp-mac-*" "obsidian-mcp-linux-*"; do
        EXTRACTED_BINARY=$(find . -name "$pattern" -type f ! -name "*.zip" ! -name "*.tar.gz" | head -1)
        if [[ -n "$EXTRACTED_BINARY" ]]; then
            break
        fi
    done
fi

if [[ -z "$EXTRACTED_BINARY" ]]; then
    echo -e "${RED}❌ Error: Could not find binary in archive${NC}"
    echo "Archive contents:"
    case "$ARCHIVE_EXT" in
        "zip")
            unzip -l "$ARCHIVE_NAME" || echo "Could not list zip contents"
            ;;
        "tar.gz")
            tar -tzf "$ARCHIVE_NAME" || echo "Could not list tar contents"
            ;;
    esac
    echo "Files found:"
    find . -type f
    rm -rf "$TEMP_DIR"
    exit 1
fi

echo -e "${GREEN}✓ Found binary: $EXTRACTED_BINARY${NC}"

# Verify it's actually a binary
if ! file "$EXTRACTED_BINARY" | grep -q "executable"; then
    echo -e "${RED}❌ Error: Found file is not an executable binary${NC}"
    file "$EXTRACTED_BINARY"
    rm -rf "$TEMP_DIR"
    exit 1
fi

# Install the binary
echo -e "${BLUE}🚀 Installing to $INSTALL_DIR/$BINARY_NAME...${NC}"
cp "$EXTRACTED_BINARY" "$INSTALL_DIR/$BINARY_NAME"
chmod +x "$INSTALL_DIR/$BINARY_NAME"

# Cleanup
rm -rf "$TEMP_DIR"

# Verify installation
if [[ -f "$INSTALL_DIR/$BINARY_NAME" ]]; then
    echo -e "${GREEN}✅ Installation successful!${NC}"

    # Test the binary
    echo -e "${BLUE}🔍 Testing installation...${NC}"
    INSTALLED_VERSION=$("$INSTALL_DIR/$BINARY_NAME" --version 2>/dev/null | head -1 || echo "Could not get version")
    echo -e "${GREEN}✓ Installed version: $INSTALLED_VERSION${NC}"

    echo
    echo -e "${BLUE}📋 Next Steps:${NC}"
    echo "━━━━━━━━━━━━━━━"

    # Platform-specific PATH instructions
    case "$(uname -s)" in
        CYGWIN*|MINGW*|MSYS*)
            # Windows PATH check
            if [[ ":$PATH:" != *":$HOME/bin:"* ]]; then
                echo -e "${YELLOW}⚠️  ~/bin is not in your PATH${NC}"
                echo "Add this to your shell profile (~/.bashrc or ~/.zshrc):"
                echo
                echo -e "${GREEN}export PATH=\"\$HOME/bin:\$PATH\"${NC}"
                echo
                echo "Or use the full path:"
                echo -e "${GREEN}$INSTALL_DIR/$BINARY_NAME --help${NC}"
            else
                echo -e "${GREEN}✓ ~/bin is in your PATH${NC}"
                echo "You can now run: ${GREEN}$BINARY_NAME --help${NC}"
            fi
            ;;
        "Darwin")
            # macOS PATH check
            if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                echo -e "${YELLOW}⚠️  ~/.local/bin is not in your PATH${NC}"
                echo "Add this to your shell profile (~/.zshrc):"
                echo
                echo -e "${GREEN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
                echo
                echo "Then reload your shell or run: source ~/.zshrc"
                echo
                echo "Alternative: Run directly with full path:"
                echo -e "${GREEN}$INSTALL_DIR/$BINARY_NAME --help${NC}"
            else
                echo -e "${GREEN}✓ ~/.local/bin is in your PATH${NC}"
                echo "You can now run: ${GREEN}$BINARY_NAME --help${NC}"
            fi
            ;;
        "Linux")
            # Linux PATH check
            if [[ ":$PATH:" != *":$HOME/.local/bin:"* ]]; then
                echo -e "${YELLOW}⚠️  ~/.local/bin is not in your PATH${NC}"
                echo "Add this to your shell profile (~/.bashrc or ~/.zshrc):"
                echo
                echo -e "${GREEN}export PATH=\"\$HOME/.local/bin:\$PATH\"${NC}"
                echo
                echo "Then reload your shell or run: source ~/.bashrc"
                echo
                echo "Alternative: Run directly with full path:"
                echo -e "${GREEN}$INSTALL_DIR/$BINARY_NAME --help${NC}"
            else
                echo -e "${GREEN}✓ ~/.local/bin is in your PATH${NC}"
                echo "You can now run: ${GREEN}$BINARY_NAME --help${NC}"
            fi
            ;;
    esac

    echo
    echo -e "${BLUE}🧪 Quick Test:${NC}"
    echo -e "${GREEN}$BINARY_NAME --help${NC}"
    echo
    echo -e "${BLUE}📖 Documentation:${NC}"
    echo "https://github.com/$REPO#setup-guide"

else
    echo -e "${RED}❌ Installation failed${NC}"
    exit 1
fi