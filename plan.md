# Obsidian MCP Server Development Plan (Deno)

## Project Overview

Create a Model Context Protocol (MCP) server that enables AI models to interact with Obsidian vaults through the Local REST API plugin, built with Deno and TypeScript.

## Phase 1: Foundation (Week 1)

1. **Research MCP SDK for Deno**
   - [x] Study MCP documentation and Deno-specific examples
   - [x] Fork and analyze deno2-playwright-mcp-server as reference

2. **Project Setup**
   - [x] Initialize Deno project with TypeScript
   - [x] Configure deno.json with proper permissions
   - [x] Set up development environment with hot reloading

3. **Obsidian Integration Testing**
   - [x] Install Obsidian Local REST API plugin
   - [x] Test API endpoints manually
   - [x] Document authentication requirements

## Phase 2: Core Implementation (Week 2-3)

1. **Authentication Layer**
   - [x] Implement secure API key handling
   - [x] Create configuration system (.env support)
   - [x] Add connection validation

2. **MCP Server Foundation**
   - [x] Implement basic MCP server using official SDK
   - [x] Set up JSON-RPC communication
   - [x] Create tool registration system

3. **File Operations**
   - [x] `get_file`: Retrieve note contents
   - [x] `put_file`: Create/replace notes
   - [x] `patch_file`: Modify specific sections
   - [x] `delete_file`: Remove notes

## Phase 3: Advanced Features (Week 4)

1. **Search Capabilities** _(Not available in current Obsidian Local REST API version)_
   - [x] `search_simple`: Text-based search with context _(API endpoint returns 404)_
     - [x] Query parameter for search text
     - [x] Optional context length for match snippets
   - [x] `search_advanced`: Complex search using Dataview DQL or JsonLogic _(API endpoint returns 404)_
     - [x] Support for Dataview query language
     - [x] JsonLogic query format option
     - [x] Return matching files with results

2. **Active Note Operations**
   - [x] `get_active`: Get current active note content
   - [x] `append_active`: Append content to active note
   - [x] `replace_active`: Replace entire active note
   - [x] `patch_active`: Modify specific sections
   - [ ] `delete_active`: Delete active note _(Not implemented - requires separate endpoint)_

3. **Additional Operations**
   - **Periodic Notes** _(Not available in current Obsidian Local REST API version)_
     - [x] Get/create daily, weekly, monthly notes _(API endpoint returns 404)_
     - [x] Support for custom periodic note templates _(API endpoint returns 404)_
   - **Command Execution**
     - [x] List available Obsidian commands
     - [x] Execute commands by ID
   - **Vault Navigation**
     - [x] List directory contents _(Implemented via list_files)_
     - [ ] Get file metadata

## Phase 4: Polish & Distribution (Week 5)

1. **Testing & Quality**
   - [x] Unit tests for all operations
   - [x] Integration tests with mock Obsidian API
   - [x] Error handling and edge cases

2. **Documentation**
   - [x] Installation guide
   - [x] Configuration instructions
   - [x] Usage examples
   - [x] API reference for all MCP tools

3. **Distribution**
   - [x] Compile to standalone binary
   - [x] Create release pipeline
   - [ ] Publish to package registry

## Technical Stack

- **Runtime**: Deno 2.x
- **Language**: TypeScript (strict mode)
- **Libraries**:
  - MCP SDK for Deno
  - Zod for schema validation
  - Standard Deno libraries

## Key Design Decisions

- Use Deno's built-in tools (testing, formatting, linting)
- Follow MCP's JSON-RPC 2.0 protocol strictly
- Maintain compatibility with Claude Desktop
- Support both local development and compiled binary deployment
- Implement comprehensive search capabilities (simple text and advanced queries)
- Full parity with Obsidian Local REST API features
- Modular tool architecture for easy extension
