# Obsidian Local REST API Documentation

Based on testing with Obsidian Local REST API v3.2.0

## Authentication

The API requires authentication via Bearer token:

- Header: `Authorization: Bearer <API_KEY>`
- API key is found in Obsidian settings under "Local REST API"
- Without authentication, most endpoints return 401 Unauthorized

## Available Endpoints

### 1. Root Endpoint

- **GET /**
  - Returns API status and version information
  - Always accessible (no auth required for basic info)
  - Shows authentication status when auth header is provided

### 2. Vault Operations

- **GET /vault/** - List all files in vault
- **GET /vault/{path}** - Get file content
- **PUT /vault/{path}** - Create/update file
  - Content-Type: text/markdown
  - Body: file content
- **DELETE /vault/{path}** - Delete file
- **PATCH /vault/{path}** - Update file (partial)

### 3. Commands

- **GET /commands/** - List all available Obsidian commands
- **POST /commands/{commandId}** - Execute a command

### 4. Active Note

- **GET /active/** - Get current active note
  - Note: Response format appears to have JSON parsing issues
- **PUT /active/** - Replace active note content
- **PATCH /active/** - Update active note (partial)
- **POST /active/** - Append to active note

### 5. Search (Not Found - 404)

- **/search/simple/** - Not available in current version
- **/search/** - Not available in current version

### 6. Periodic Notes (Not Found - 404)

- **/periodic/** - Not available in current version

## Key Findings

1. **Authentication is mandatory** for most operations
2. **File paths** in the vault use forward slashes and are relative to vault root
3. **Successful modifications** return 204 No Content
4. **Content-Type** should be set appropriately (text/markdown for .md files)
5. **Commands** provide access to all Obsidian functionality programmatically

## Response Codes

- 200 OK - Successful GET requests
- 204 No Content - Successful PUT/DELETE operations
- 401 Unauthorized - Missing or invalid API key
- 404 Not Found - Endpoint or file not found
