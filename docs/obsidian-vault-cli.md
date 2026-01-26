# Obsidian Vault CLI

A bash CLI alternative to the MCP server for environments where MCP is not available.

## Requirements

- [httpie](https://httpie.io/) (`pip install httpie`)
- [jq](https://jqlang.github.io/jq/)
- Obsidian with [Local REST API](https://github.com/coddingtonbear/obsidian-local-rest-api) plugin enabled

## Installation

```bash
# Copy the script
cp bin/obsidian-vault-cli /usr/local/bin/
chmod +x /usr/local/bin/obsidian-vault-cli

# Or add to PATH
export PATH="$PATH:/path/to/obsidian-mcp/bin"
```

## Configuration

Set environment variables directly or via `.env.obsidian` file:

```bash
# .env.obsidian
OBSIDIAN_API_URL="http://localhost:27123"
OBSIDIAN_API_KEY="your-api-key-here"
```

The CLI looks for `.env.obsidian` in:
1. The script's directory
2. The current working directory

## Commands

### ping

Test the API connection.

```bash
$ obsidian-vault-cli ping
Connected to http://localhost:27123
```

### list_files

List files in the vault root or a specific directory.

```bash
# List root directories
$ obsidian-vault-cli list_files
Documents/
Projects/
Daily Notes/
Templates/

# List files in a subdirectory
$ obsidian-vault-cli list_files "Projects/"
project-alpha.md
project-beta.md
meeting-notes.md
archive/
```

### get_file

Get file contents as markdown.

```bash
$ obsidian-vault-cli get_file "Projects/project-alpha.md"
---
title: Project Alpha
tags:
  - project
  - active
created: 2025-01-15
modified: 2025-01-20
---
# Project Alpha

Project description and notes...
```

### get_file_json

Get file with metadata (frontmatter, tags, stats) as JSON.

```bash
$ obsidian-vault-cli get_file_json "Projects/project-alpha.md"
{
  "tags": [
    "project",
    "active"
  ],
  "frontmatter": {
    "title": "Project Alpha",
    "tags": [
      "project",
      "active"
    ],
    "created": "2025-01-15",
    "modified": "2025-01-20"
  },
  "stat": {
    "ctime": 1736956800000,
    "mtime": 1737388800000,
    "size": 1024
  },
  "path": "Projects/project-alpha.md",
  "content": "---\ntitle: Project Alpha\n..."
}
```

### search

Search for files by content or filename. Returns full file paths with relevance scores.

**Use case:** Find the full path to a file when you only know its name.

```bash
$ obsidian-vault-cli search "meeting notes"
Projects/meetings/weekly-standup.md (score: 0.95)
Daily Notes/2025-01-20.md (score: 0.72)
Archive/2024-meeting-notes.md (score: 0.45)
```

## MCP vs CLI Comparison

| Feature | MCP Tool | CLI Command |
|---------|----------|-------------|
| Test connection | `mcp__obsidian__ping` | `obsidian-vault-cli ping` |
| List files | `mcp__obsidian__list_files` | `obsidian-vault-cli list_files` |
| Get file | `mcp__obsidian__get_file` | `obsidian-vault-cli get_file` |
| Search | `mcp__obsidian__search` | `obsidian-vault-cli search` |

Both provide the same functionality. Use MCP when available (better integration with AI assistants), use CLI for scripting or environments without MCP support.
