# MCP Improvements Based on Anthropic Recommendations

## Overview

This document outlines potential improvements to the Obsidian MCP server based on Anthropic's blog post on [Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp). The recommendations focus on **progressive tool discovery** and **context-efficient data handling** to reduce token consumption and improve agent performance.

## Current State Analysis

The current implementation loads all 15+ tools upfront and returns complete, unfiltered data:
- `list_files` returns all filenames without filtering
- `get_file` returns entire file contents
- No metadata-only operations
- No pagination or range support
- No batch operations

This approach can consume significant tokens when working with large vaults or files.

## Key Principles from Anthropic Blog

1. **Progressive Tool Discovery**: Present tools as code APIs; agents explore and load only needed definitions on-demand
2. **Context-Efficient Filtering**: Process data in execution environment and return only summarized results
3. **Privacy-Preserving Operations**: Keep intermediate results in execution environment by default
4. **Control Flow Optimization**: Leverage programming constructs (loops, conditionals) rather than chaining individual tool calls
5. **State Management**: Enable agents to persist intermediate results and reusable code

## Recommended Improvements

### 🟢 High Impact, Low Effort

#### 1. Add Filtering and Pagination to `list_files`

**Rationale**: Vaults can contain hundreds or thousands of files. Agents often need only a subset.

**Implementation**:
- Add optional parameters:
  - `pattern` (string): Glob pattern for filtering (e.g., `"*.md"`, `"Daily Notes/**"`)
  - `limit` (number): Maximum files to return
  - `offset` (number): Skip first N files (for pagination)
  - `sortBy` (enum): Sort order (`"name"`, `"modified"`, `"created"`, `"size"`)
  - `includeMetadata` (boolean): Include file metadata in response
- Return summary information:
  - Total count (before pagination)
  - Directory statistics
  - File type breakdown

**Example**:
```typescript
// Instead of returning 1000 files
{ files: ["file1.md", "file2.md", ...] }

// Return filtered, paginated results with metadata
{
  total: 1000,
  returned: 50,
  offset: 0,
  files: [
    { path: "file1.md", size: 1024, modified: "2025-01-08T..." },
    ...
  ],
  summary: {
    directories: 15,
    fileTypes: { "md": 980, "png": 20 }
  }
}
```

**Effort**: Low (1-2 hours)
**Impact**: High (significantly reduces token usage for large vaults)

#### 2. Add File Metadata Tool

**Rationale**: Agents can make informed decisions before fetching full content.

**Implementation**:
- New tool: `get_file_metadata`
- Parameters: `path` (string)
- Returns:
  - File size
  - Creation date
  - Modification date
  - Obsidian-specific metadata (tags, frontmatter keys)
  - First N characters as preview (optional)

**Example**:
```typescript
{
  path: "Research/AI Models.md",
  size: 45678,
  created: "2024-12-01T10:30:00Z",
  modified: "2025-01-08T15:45:00Z",
  frontmatter: {
    tags: ["ai", "research"],
    type: "note"
  },
  preview: "# AI Models\n\nThis document explores..."
}
```

**Effort**: Low (1-2 hours)
**Impact**: High (avoids fetching large files unnecessarily)

#### 3. Enhanced `get_file` with Range Support

**Rationale**: Large documents consume excessive tokens when only a section is needed.

**Implementation**:
- Add optional parameters to existing `get_file`:
  - `startLine` (number): Start reading from this line
  - `endLine` (number): Stop reading at this line
  - `maxLines` (number): Maximum lines to return
  - `search` (string): Return only sections containing this text
- Return metadata about the full file along with partial content

**Example**:
```typescript
// Request
{ path: "Long Document.md", startLine: 100, maxLines: 50 }

// Response
{
  content: "...(50 lines)...",
  metadata: {
    totalLines: 5000,
    returnedRange: [100, 150],
    fileSize: 125000
  }
}
```

**Effort**: Low (2-3 hours)
**Impact**: High (critical for large documents)

### 🟡 High Impact, Medium Effort

#### 4. Add Search/Filter Tool

**Rationale**: Process filtering in execution environment; return summaries instead of full content.

**Implementation**:
- New tool: `search_files`
- Parameters:
  - `query` (string): Search term or regex
  - `path` (string, optional): Limit to specific directory
  - `caseSensitive` (boolean): Case-sensitive search
  - `returnContent` (boolean): Return matching lines or just metadata
  - `maxResults` (number): Limit results
  - `contextLines` (number): Lines before/after matches

**Example**:
```typescript
// Instead of: list all files -> get each file -> filter in LLM
// Do: search in execution environment, return summaries

{
  query: "quantum computing",
  totalMatches: 15,
  files: [
    {
      path: "Research/Quantum.md",
      matches: 7,
      snippets: [
        { line: 45, text: "...quantum computing enables..." },
        { line: 102, text: "...quantum computing applications..." }
      ]
    },
    ...
  ]
}
```

**Effort**: Medium (4-6 hours)
**Impact**: High (avoids fetching and processing many files)

#### 5. Batch Operations Support

**Rationale**: Reduce round-trips and token usage for multiple operations.

**Implementation**:
- New tool: `batch_file_operations`
- Parameters:
  - `operations` (array): List of operations to perform
    - Each operation: `{ type: "get" | "put" | "delete" | "patch", path: string, content?: string }`
  - `stopOnError` (boolean): Stop batch on first error or continue
  - `returnContent` (boolean): Return file contents or just success/failure
- Returns summarized results

**Example**:
```typescript
// Request
{
  operations: [
    { type: "get", path: "file1.md" },
    { type: "put", path: "file2.md", content: "..." },
    { type: "delete", path: "file3.md" }
  ],
  returnContent: false
}

// Response
{
  results: [
    { path: "file1.md", status: "success", size: 1024 },
    { path: "file2.md", status: "success" },
    { path: "file3.md", status: "success" }
  ],
  summary: { successful: 3, failed: 0 }
}
```

**Effort**: Medium (4-6 hours)
**Impact**: High (reduces token usage for multi-file workflows)

#### 6. Directory Operations & Structure

**Rationale**: Help agents understand vault organization efficiently.

**Implementation**:
- New tool: `get_directory_structure`
  - Parameters: `path` (optional), `maxDepth` (number), `includeFiles` (boolean)
  - Returns: Tree structure with statistics

- New tool: `list_directory`
  - Parameters: `path` (string), `recursive` (boolean), `includeMetadata` (boolean)
  - Returns: Contents of specific directory with metadata

**Example**:
```typescript
// get_directory_structure
{
  path: "/",
  structure: {
    "Daily Notes": { files: 365, size: 2048000, subdirs: 0 },
    "Research": { files: 42, size: 512000, subdirs: 3 },
    "Projects": { files: 156, size: 1024000, subdirs: 8 }
  },
  totalFiles: 563,
  totalSize: 3584000
}
```

**Effort**: Medium (3-4 hours)
**Impact**: Medium-High (improves navigation efficiency)

### 🔵 Lower Priority (Architectural Changes)

#### 7. Code Execution Layer

**Rationale**: Mentioned in Anthropic blog but requires significant infrastructure.

**Challenges**:
- Requires secure execution environment with sandboxing
- Resource limits and monitoring needed
- Operational overhead
- Security implications for running agent-generated code
- Not aligned with current MCP server design pattern

**Recommendation**: **Not recommended** for this project. The current tool-based approach is more appropriate for Obsidian vault operations. Code execution is better suited for general-purpose computational tasks.

**Effort**: Very High (weeks)
**Impact**: Low (not aligned with use case)

## Implementation Plan

### Phase 1: File Metadata & Enhanced Reading (Items 2, 3)
**Timeline**: 1 week
**Deliverables**:
- `get_file_metadata` tool
- Enhanced `get_file` with range parameters
- Tests and documentation

**Benefits**: Immediate reduction in token usage for large files

### Phase 2: List Filtering & Pagination (Item 1)
**Timeline**: 1 week
**Deliverables**:
- Enhanced `list_files` with filtering, pagination, sorting
- Summary statistics
- Tests and documentation

**Benefits**: Significant token reduction for large vaults

### Phase 3: Search & Directory Tools (Items 4, 6)
**Timeline**: 2 weeks
**Deliverables**:
- `search_files` tool
- `get_directory_structure` tool
- `list_directory` tool
- Tests and documentation

**Benefits**: More efficient vault exploration and content discovery

### Phase 4: Batch Operations (Item 5)
**Timeline**: 1 week
**Deliverables**:
- `batch_file_operations` tool
- Transaction support (rollback on error)
- Tests and documentation

**Benefits**: Reduced round-trips for multi-file operations

## Success Metrics

1. **Token Usage Reduction**: Measure token consumption before/after for common workflows
2. **Response Time**: Latency improvements from reduced data transfer
3. **User Feedback**: Agent performance and task completion rates
4. **Error Rates**: Ensure new features don't introduce instability

## References

- [Anthropic: Code Execution with MCP](https://www.anthropic.com/engineering/code-execution-with-mcp)
- [MCP Specification](https://modelcontextprotocol.io/)
- [Obsidian Local REST API Documentation](https://github.com/coddingtonbear/obsidian-local-rest-api)

## Conclusion

These improvements align with Anthropic's recommendations for building efficient MCP servers. By focusing on **context-efficient data handling** and **progressive tool discovery**, we can significantly reduce token consumption while improving agent performance. The phased implementation plan prioritizes high-impact, low-effort improvements first, allowing for iterative validation and feedback.
