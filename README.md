# Kapi-Lite

## Code Review Feature Implementation Plan

### Overview
Kapi-Lite will provide local code review functionality by accessing the user's filesystem through Electron's Node.js integration. This feature will allow users to select directories for scanning, analyze code files, and receive AI-powered suggestions for improvement.

### Directory Permission System
1. **Permission Collection**
   - Prompt users to select directories they want to analyze
   - Store allowed directories in application settings
   - Provide a UI to manage these permissions

2. **Security Layer**
   - Validate all file operations against allowed directories
   - Prevent access to system directories or sensitive files

### File System Integration
1. **Scanning and Indexing**
   - Recursively read allowed directories
   - Filter relevant code files (respecting .gitignore)
   - Build an index of files for quick access

2. **File Content Analysis**
   - Parse files to extract structure (functions, classes)
   - Generate metadata (size, complexity, etc.)
   - Detect changes between file versions

### LLM Integration for Code Review
1. **Processing Pipeline**
   - Bundle selected files with context
   - Generate focused review prompts
   - Send to LLM API for analysis

2. **Result Presentation**
   - Display suggestions inline with code
   - Provide actionable items
   - Enable user feedback on suggestions

### Cross-Platform Compatibility
This implementation will work across Windows, macOS, and Linux by:
- Using Node.js path utilities to handle different path formats
- Implementing platform-aware file access patterns
- Properly handling file permissions across systems
- Using Electron's platform detection for OS-specific behavior

### User Privacy
- Process files locally when possible
- Only send necessary code to external APIs
- Allow users to exclude sensitive files/directories
- Provide transparent logging of shared content

### Implementation Notes
- Use Node.js `fs` module in the main process
- Create a secure IPC channel between renderer and main processes
- Implement proper error handling for file system operations
- Support watching for file changes for real-time reviews

## Using the Code Review Feature

### Integrated Chat Approach
The code review functionality is integrated directly into the Chat interface for a seamless user experience:

1. **Trigger via Chat Command**:
   - Start a chat message with the prefix `CodeReview:` (case insensitive)
   - Add your review request after the prefix
   - Example: `CodeReview: Check for security vulnerabilities in my authentication code`

2. **Directory Selection**:
   - After sending a code review request, you'll be prompted to select a directory
   - The system will scan the directory, excluding binary files, node_modules, etc.
   - Code files will be collected and sent to the AI for analysis

3. **Review Results**:
   - The AI will analyze your code and provide a detailed review
   - Results include overall structure, strengths, and areas for improvement
   - Specific suggestions for improvements will be highlighted

### Implementation Details
- The system automatically filters out binary files, configuration files, and other non-code files
- Default excluded directories include node_modules, .git, build directories, etc.
- Files are processed with relative paths to maintain context
- Token counting helps ensure the request stays within AI model limits