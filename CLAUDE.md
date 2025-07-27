# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an Obsidian MCP (Model Context Protocol) server built with Deno and TypeScript. The project aims to enable AI models to interact with Obsidian vaults through the Obsidian Local REST API plugin.

## Commands

### Development & Testing

- `deno task dev` - Run the development server with file watching
- `deno test` - Run all tests
- `deno fmt` - Format code using Deno's built-in formatter
- `deno lint` - Lint code using Deno's built-in linter

### Building & Running

- `deno run main.ts` - Run the main application
- `deno compile main.ts` - Compile to standalone binary

## Architecture & Structure

This MCP server is being developed to provide comprehensive access to Obsidian vaults via the Local REST API. The planned architecture includes:

### Core Components (Planned)

1. **Authentication Layer** - Secure API key handling and connection validation
2. **MCP Server Foundation** - JSON-RPC communication following MCP protocol
3. **File Operations** - CRUD operations for Obsidian notes
4. **Search Capabilities** - Both simple text search and advanced Dataview/JsonLogic queries
5. **Active Note Operations** - Interact with the currently active note in Obsidian

### Key Technical Decisions

- Uses Deno's built-in tooling (testing, formatting, linting)
- Follows MCP's JSON-RPC 2.0 protocol
- Designed for both local development and compiled binary deployment
- Modular tool architecture for extensibility

## Development Status

**Phase 1 Complete!** Current implementation includes:

### Core Infrastructure

- Deno project with TypeScript strict mode configuration
- MCP server with stdio transport using official SDK
- Environment-based configuration system (.env support)
- ObsidianApiClient module with comprehensive error handling
- Multi-platform build tasks for standalone binaries
- Test suite with unit tests

### Available MCP Tools

- **Connectivity**: `ping` - Test API connectivity
- **File Operations**: `list_files`, `get_file`, `put_file`, `delete_file`
- **Command Operations**: `list_commands`, `execute_command`

### Documentation

- API endpoint documentation in `docs/obsidian-api-findings.md`
- Authentication requirements documented
- Test script for manual API exploration

**Next Phase**: Implement advanced features like active note operations and search capabilities (Phase 2 & 3 from development plan).
