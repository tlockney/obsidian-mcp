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

## Reconsidering Technical Plans Management Tools

The current Technical Plans Management tools (`create_technical_plan`, `mark_plan_reviewed`, `archive_plan`, `list_technical_plans`, etc.) were designed for a specific workflow: capturing AI-generated plans, reviewing them, and archiving them. These tools could benefit significantly from the Anthropic recommendations:

### Current State

The technical plans tools are:

- **Workflow-specific**: Tightly coupled to a particular folder structure (Inbox/Reviewed/Archive)
- **Limited filtering**: `list_technical_plans` returns all plans or all in a folder
- **No search**: Can't search plan content or metadata efficiently
- **No aggregation**: Can't get summaries across plans

### Potential Improvements

#### 1. Consolidate into Generic Workflow Tools

Instead of hardcoding the "technical plans" concept, create generic workflow management tools:

**Replace**:

- `create_technical_plan` → `create_workflow_item`
- `mark_plan_reviewed` → `transition_workflow_item`
- `archive_plan` → `transition_workflow_item`

**With**:

```typescript
// Generic workflow tool
{
  tool: "manage_workflow",
  config: {
    basePath: "Technical Plans",
    states: ["Inbox", "Reviewed", "Archive"],
    requiredMetadata: ["project", "type", "priority"]
  },
  operation: "create" | "transition" | "list" | "search"
}
```

**Benefits**:

- Reusable for other workflows (e.g., "Meeting Notes", "Project Ideas")
- Less tool proliferation
- Agents can customize workflows

#### 2. Add Context-Efficient Plan Summaries

**Current**: `list_technical_plans` returns full file paths and metadata

**Improved**:

```typescript
{
  tool: "summarize_plans",
  filters: {
    folder: "inbox",
    project: "obsidian-mcp",
    daysOld: 7
  },
  groupBy: "project",
  fields: ["title", "type", "created", "status"]
}

// Response: Summarized, grouped data
{
  summary: {
    totalPlans: 15,
    byProject: {
      "obsidian-mcp": { count: 5, avgAge: 3 },
      "other-project": { count: 10, avgAge: 14 }
    },
    byType: {
      "Architecture": 8,
      "Implementation": 7
    }
  },
  plans: [
    { title: "MCP Improvements", project: "obsidian-mcp", type: "Architecture", age: 2 },
    ...
  ]
}
```

**Benefits**:

- Reduced token usage (no full paths or unnecessary metadata)
- Quick overview without fetching full plans
- Easier decision-making

#### 3. Add Cross-Plan Search and Analysis

**New Tool**: `search_plans`

```typescript
{
  tool: "search_plans",
  query: "pagination filtering",
  searchFields: ["content", "title", "metadata"],
  returnFormat: "snippets" | "summaries" | "full",
  maxResults: 10
}

// Response: Processed in execution environment
{
  totalMatches: 3,
  plans: [
    {
      path: "Inbox/mcp-improvements.md",
      relevance: 0.95,
      snippets: ["Add filtering and pagination to list_files..."],
      metadata: { project: "obsidian-mcp", type: "Architecture" }
    }
  ]
}
```

**Benefits**:

- Find related plans without fetching all content
- Process search in execution environment
- Return only relevant excerpts

#### 4. Batch Plan Operations

**New Tool**: `batch_plan_operations`

```typescript
{
  tool: "batch_plan_operations",
  operations: [
    { action: "transition", filename: "plan1.md", newState: "reviewed" },
    { action: "transition", filename: "plan2.md", newState: "reviewed" },
    { action: "archive", filter: { daysOld: 30, state: "reviewed" } }
  ]
}

// Response: Summary only
{
  transitions: 2,
  archived: 5,
  errors: 0
}
```

**Benefits**:

- Bulk operations in single call
- Reduced round-trips
- Transaction-like semantics

#### 5. Template-Based Plan Creation

**Enhanced Tool**: `create_plan_from_template`

```typescript
{
  tool: "create_plan_from_template",
  template: "architecture-review",  // Predefined template
  variables: {
    project: "obsidian-mcp",
    component: "file-operations"
  },
  content: "...",
  autoPopulateSections: true  // Fill in boilerplate
}
```

**Benefits**:

- Consistent plan structure
- Less redundant content in context
- Faster plan creation

### Alternative: Simplify or Remove?

Given the Anthropic principles, another option is to **simplify dramatically** or **remove the specialized tools** entirely:

**Option A: Use Generic File Tools + Conventions**

Instead of specialized tools, use:

- `put_file` with a naming convention: `Technical Plans/Inbox/{project}-{type}-{date}.md`
- `list_files` with pattern: `Technical Plans/Inbox/*.md`
- `search_files` to find plans
- Frontmatter metadata for structured data

Agents can implement the workflow logic in their own code/prompts.

**Option B: Single Unified Tool**

Collapse all technical plans tools into one:

```typescript
{
  tool: "manage_technical_plans",
  action: "create" | "list" | "search" | "transition" | "archive",
  params: { /* action-specific parameters */ }
}
```

### Recommendation

**Progressive approach**:

1. **Short term**: Add filtering/search to `list_technical_plans`, add `search_plans`
2. **Medium term**: Consider generalizing to workflow management (reusable pattern)
3. **Long term**: Evaluate if specialized tools add enough value vs. generic file tools + conventions

The key insight from Anthropic is that **domain-specific tools should still follow context-efficient patterns**. Even specialized workflows benefit from:

- Filtering and pagination
- Metadata-only operations
- Search with summaries
- Batch operations

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

## Architectural Alternatives: Beyond the REST API

The current implementation relies on the Obsidian Local REST API plugin as an intermediary. This architectural decision has significant implications for how efficiently we can implement the Anthropic recommendations. It's worth exploring alternative approaches:

### Option 1: Continue with REST API Extension (Current)

**How it works**: MCP server → HTTP → Obsidian Local REST API plugin → Obsidian

**Strengths**:

- ✅ Access to active note operations
- ✅ Can execute Obsidian commands (graph view, daily notes, etc.)
- ✅ Works with live Obsidian state
- ✅ No need to parse vault structure or understand Obsidian internals
- ✅ Already implemented and working

**Limitations for Anthropic recommendations**:

- ❌ **Network overhead**: Every operation requires HTTP round-trip
- ❌ **Limited filtering**: Can't efficiently filter/search before returning data
- ❌ **No caching**: Can't cache metadata or build indexes
- ❌ **API constraints**: Limited by what the REST API exposes
- ❌ **Inefficient for batch operations**: Each file operation is separate HTTP call
- ❌ **No custom search**: Can't implement efficient search with snippets

**Token efficiency**: Medium - Returns full data, limited filtering capabilities

**Best for**: Users who need integration with live Obsidian state (active note, commands)

### Option 2: New Native Obsidian Extension

**How it works**: MCP protocol natively implemented as Obsidian plugin

**Strengths**:

- ✅ Direct access to all Obsidian APIs
- ✅ No network overhead
- ✅ Can access workspace state, settings, plugins
- ✅ Could implement sophisticated caching and indexing
- ✅ Better error handling and validation
- ✅ Can hook into Obsidian events (file changes, etc.)

**Limitations**:

- ❌ **Development complexity**: Need to learn Obsidian plugin API (TypeScript)
- ❌ **Maintenance burden**: Plugin updates, compatibility with Obsidian versions
- ❌ **Still requires Obsidian running**: No standalone mode
- ❌ **Distribution**: Users must install plugin through Community Plugins

**Token efficiency**: High - Can implement all Anthropic recommendations efficiently

**Implementation effort**: Medium-High (2-4 weeks)

**Example use cases enabled**:

- Efficient metadata-only queries without file reads
- Built-in search index with snippet extraction
- Batch operations with transactions
- Real-time vault monitoring and incremental updates

### Option 3: Standalone Filesystem Server

**How it works**: MCP server accesses vault files directly (no Obsidian required)

**Strengths**:

- ✅ **No Obsidian dependency**: Works with closed vaults
- ✅ **Maximum performance**: Direct file system access
- ✅ **Sophisticated indexing**: Can build and maintain search indexes
- ✅ **Efficient filtering**: Process files before returning data
- ✅ **Caching and metadata**: Can maintain metadata database
- ✅ **Batch operations**: Efficient multi-file operations
- ✅ **Best for Anthropic patterns**: Full control over data processing

**Limitations**:

- ❌ **No active note**: Can't access currently open note
- ❌ **No command execution**: Can't trigger Obsidian commands
- ❌ **Must parse vault structure**: Need to understand Obsidian format
- ❌ **Sync conflicts**: If Obsidian is also running
- ❌ **Plugin-specific features**: Can't access Dataview, graph, etc.

**Token efficiency**: Very High - Can implement all recommendations optimally

**Implementation effort**: Medium (1-2 weeks for basic version)

**Key capabilities enabled**:

```typescript
// Example: Efficient metadata-only operation
const metadata = await vaultIndex.getFileMetadata("path/to/note.md");
// No file read required - served from index

// Example: Search with snippets (processed locally)
const results = await vaultIndex.search("quantum computing", {
  returnFormat: "snippets",
  contextLines: 2,
  maxResults: 10,
});
// Only returns relevant excerpts, not full files

// Example: Batch operations with rollback
const batch = vault.beginTransaction();
batch.updateFile("note1.md", content1);
batch.deleteFile("note2.md");
batch.createFile("note3.md", content3);
await batch.commit(); // or rollback() on error
```

**Technology options**:

- **SQLite**: For metadata index (tags, frontmatter, links, backlinks)
- **File watchers**: Detect changes and update index
- **Markdown parser**: Extract frontmatter, links, headings
- **Full-text search**: Using FTS5 or similar

### Option 4: Hybrid Approach

**How it works**: Standalone server for read operations + REST API for live features

**Strengths**:

- ✅ **Best of both worlds**: Fast reads, live Obsidian integration when needed
- ✅ **Graceful degradation**: Works without Obsidian, enhanced when running
- ✅ **Optimal token efficiency**: Direct file access for most operations
- ✅ **Maintains compatibility**: Can still use active note and commands

**Architecture**:

```typescript
class ObsidianMCPServer {
  private fileSystemVault: DirectVaultAccess; // For reads, search, metadata
  private restApiClient?: ObsidianApiClient; // For active note, commands

  async listFiles(filter?: string) {
    // Use filesystem (faster, can filter locally)
    return this.fileSystemVault.listFiles(filter);
  }

  async getActiveNote() {
    // Requires Obsidian running
    if (!this.restApiClient) {
      throw new Error("Requires Obsidian with REST API plugin");
    }
    return this.restApiClient.getActiveFile();
  }

  async searchFiles(query: string) {
    // Use indexed search (much faster)
    return this.fileSystemVault.search(query);
  }
}
```

**Implementation effort**: Medium-High (3-4 weeks)

**Token efficiency**: Very High for most operations, fallback to Medium for live features

### Comparison Matrix

| Feature                 | REST API | Native Plugin | Standalone | Hybrid    |
| ----------------------- | -------- | ------------- | ---------- | --------- |
| **Performance**         | Medium   | High          | Very High  | Very High |
| **Token Efficiency**    | Medium   | High          | Very High  | Very High |
| **Active Note**         | ✅       | ✅            | ❌         | ✅*       |
| **Commands**            | ✅       | ✅            | ❌         | ✅*       |
| **Offline Mode**        | ❌       | ❌            | ✅         | ✅        |
| **Search/Filter**       | Limited  | Good          | Excellent  | Excellent |
| **Metadata Only**       | ❌       | ✅            | ✅         | ✅        |
| **Batch Ops**           | Poor     | Good          | Excellent  | Excellent |
| **Setup Complexity**    | Low      | Medium        | Low        | Medium    |
| **Maintenance**         | Low      | Medium        | Low        | Medium    |
| **Anthropic Alignment** | Low      | Medium        | High       | High      |

*When Obsidian is running

### Recommendation

**Short term (Phase 1-2)**: Continue with REST API, but add:

- Client-side caching of file lists and metadata
- Request batching where possible
- Filtering parameters to reduce data transfer

**Medium term (Phase 3-4)**: Implement **Hybrid Approach**

- Build standalone filesystem vault access with indexing
- Maintain REST API client for live features
- Tools automatically use best available backend
- Significant token efficiency gains for most operations

**Long term**: Consider **Native Plugin**

- If Hybrid proves valuable, consider native plugin for even tighter integration
- Would enable real-time vault monitoring and incremental updates
- Best developer experience and performance

### Implementation Roadmap for Hybrid

**Stage 1: Basic Filesystem Access** (Week 1)

- Direct file read/write operations
- Frontmatter parsing
- File listing with glob patterns
- Metadata extraction (tags, links, dates)

**Stage 2: Indexing** (Week 2)

- SQLite metadata index
- Full-text search with FTS5
- File watcher for automatic index updates
- Link graph and backlinks

**Stage 3: Integration** (Week 3)

- Refactor tools to use filesystem backend
- Maintain REST API client for active note/commands
- Automatic fallback logic
- Performance benchmarking

**Stage 4: Advanced Features** (Week 4)

- Batch operations with transactions
- Advanced search with snippets
- Metadata-only queries
- Caching and optimization

### Code Execution Consideration

Interestingly, a **standalone filesystem approach** aligns better with the Anthropic code execution model:

```typescript
// Agent could write code like this:
const vault = new ObsidianVault("/path/to/vault");

// Efficient filtering and aggregation
const techDocs = vault.listFiles("Technical Plans/Inbox/*.md")
  .filter((f) => f.metadata.project === "obsidian-mcp")
  .map((f) => ({ title: f.title, age: f.daysOld }));

// Process data locally, return summary
return { count: techDocs.length, avgAge: average(techDocs.map((d) => d.age)) };
```

This is more aligned with the "code execution" paradigm from the Anthropic blog than the current tool-calling approach.

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
