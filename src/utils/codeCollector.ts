/**
 * Code Collection Utility for Code Reviews
 * 
 * Similar to the Python implementation, this utility:
 * - Collects code files from a directory
 * - Excludes binary files, node_modules, etc.
 * - Counts tokens in collected code
 */

import * as fileSystemService from '../services/fileSystemService';

// Use pathUtils from fileSystemService to avoid Node.js path module
const { pathUtils } = fileSystemService;

// Configuration (similar to Python implementation)
export const DEFAULT_EXCLUDED_DIRS = new Set([
  "node_modules", ".git", ".svn", "__pycache__", "venv", ".venv", "env",
  ".env", "dist", "build", "out", "target", ".egg-info", ".vscode", ".idea",
  "vendor", "site-packages", ".terraform", ".serverless", "coverage",
  "logs", "temp", "tmp", ".ruff_cache", ".pytest_cache", "__mocks__"
]);

export const EXCLUDED_EXTENSIONS = new Set([
  '.csv', '.json', '.yaml', '.yml', '.xml', '.txt', '.md', '.rst',
  '.bin', '.dat', '.db', '.sqlite', '.sqlite3',
  '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.tif', '.tiff', '.webp', '.svg',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx', '.ppt', '.pptx', '.odt', '.ods', '.odp',
  '.zip', '.tar', '.gz', '.bz2', '.rar', '.7z', '.jar', '.war',
  '.mp3', '.wav', '.ogg', '.flac', '.mp4', '.avi', '.mov', '.wmv', '.mkv', '.webm',
  '.exe', '.dll', '.so', '.dylib', '.pyc', '.pyo', '.o', '.a', '.obj', '.class',
  '.lock', '.sum', '.icns', '.ttf', '.otf', '.woff', '.woff2', '.log',
]);

export const DEFAULT_EXCLUDED_FILENAMES = new Set([
  '.ds_store', 'thumbs.db', 'desktop.ini', '.env', '.coverage', '__init__.py', 'license', 'changelog'
]);

export interface CollectedFile {
  path: string;
  content: string;
}

export interface CollectionResult {
  files: CollectedFile[];
  combinedContent: string;
  totalTokens: number;
  includedPaths: string[];
  debugInfo?: string[];
}

/**
 * Count tokens using the cl100k_base tokenizer model
 * This is a simple approximation since we don't have the actual tiktoken library
 */
export function countTokens(text: string): number {
  // This is a simplified approximation
  // For more accurate results, you'd need to use a proper tokenizer
  // Average English word is ~4 characters, and average token is ~4 characters
  return Math.ceil(text.length / 4);
}

/**
 * Check if a directory should be excluded based on name
 */
export function shouldExcludeDir(dirName: string): boolean {
  const lowerName = dirName.toLowerCase();
  
  // Check against excluded directory names
  if (DEFAULT_EXCLUDED_DIRS.has(lowerName)) {
    return true;
  }
  
  // Check for .egg-info pattern
  if (lowerName.endsWith('.egg-info')) {
    return true;
  }
  
  return false;
}

/**
 * Check if a file should be excluded based on name or extension
 */
export function shouldExcludeFile(fileName: string): boolean {
  const lowerName = fileName.toLowerCase();
  const ext = pathUtils.extname(lowerName);
  
  // Check against excluded filenames
  if (DEFAULT_EXCLUDED_FILENAMES.has(lowerName)) {
    return true;
  }
  
  // Check against excluded extensions
  if (ext && EXCLUDED_EXTENSIONS.has(ext)) {
    return true;
  }
  
  return false;
}

/**
 * Collect code files from a directory recursively
 */
export async function collectCodeSnippets(rootDir: string): Promise<CollectionResult> {
  console.log("collectCodeSnippets called with directory:", rootDir);
  
  // Check if file system API is available
  const fsAvailable = fileSystemService.isFileSystemApiAvailable();
  console.log("File system API available:", fsAvailable);
  
  if (!fsAvailable) {
    return {
      files: [],
      combinedContent: "ERROR: File system API is not available",
      totalTokens: 0,
      includedPaths: [],
      debugInfo: ["File system API is not available"],
    };
  }
  
  try {
    console.log("Starting to collect code files from:", rootDir);
    const collectedFiles: CollectedFile[] = [];
    const includedPaths: string[] = [];
    console.log("Excluded directories:", Array.from(DEFAULT_EXCLUDED_DIRS).slice(0, 5), "...and", DEFAULT_EXCLUDED_DIRS.size - 5, "more");
    console.log("Excluded file extensions:", Array.from(EXCLUDED_EXTENSIONS).slice(0, 5), "...and", EXCLUDED_EXTENSIONS.size - 5, "more");
    
    async function processDirectory(dirPath: string, relativePath: string = '') {
      console.log("Processing directory:", dirPath, "(relative path:", relativePath, ")");
      try {
        const dirInfo = await fileSystemService.listDirectory(dirPath);
        console.log("Found", dirInfo.files.length, "items in directory");
        
        for (const file of dirInfo.files) {
          const filePath = file.path;
          const fileRelativePath = pathUtils.join(relativePath, file.name);
          
          // Skip excluded directories
          if (file.isDirectory) {
            const shouldExclude = shouldExcludeDir(file.name);
            if (shouldExclude) {
              console.log("Skipping excluded directory:", file.name);
            } else {
              console.log("Recursing into directory:", file.name);
              await processDirectory(filePath, fileRelativePath);
            }
            continue;
          }
          
          // Skip excluded files
          const shouldExclude = shouldExcludeFile(file.name);
          if (shouldExclude) {
            console.log("Skipping excluded file:", file.name);
            continue;
          }
          console.log("Processing file:", file.name);
          
          try {
            const content = await fileSystemService.readFile(filePath);
            collectedFiles.push({
              path: filePath,
              content: content
            });
            includedPaths.push(fileRelativePath);
          } catch (error) {
            console.error(`Could not read ${filePath}:`, error);
          }
        }
      } catch (error) {
        console.error(`Error processing directory ${dirPath}:`, error);
      }
    }
    
    await processDirectory(rootDir);
    
    // Combine all collected files with file headers
    const combinedContent = collectedFiles.map(file => {
      const relativePath = pathUtils.relative(rootDir, file.path);
      return `\n\n# FILE: ${relativePath}\n\n${file.content}`;
    }).join('\n');
    
    // Count total tokens
    const totalTokens = countTokens(combinedContent);
    console.log("Collection complete. Collected", collectedFiles.length, "files with", totalTokens, "tokens");
    
    return {
      files: collectedFiles,
      combinedContent,
      totalTokens,
      includedPaths
    };
  } catch (error) {
    console.error('Error in code collection:', error);
    return {
      files: [],
      combinedContent: `ERROR: Failed to collect code: ${error instanceof Error ? error.message : 'Unknown error'}`,
      totalTokens: 0,
      includedPaths: [],
      debugInfo: [`Fatal error in collectCodeSnippets: ${error instanceof Error ? error.message : 'Unknown error'}`],
    };
  }
}

/**
 * Parse a chat command for code review
 * Returns null if not a code review command
 */
export function parseCodeReviewCommand(message: string): { command: string, args: string } | null {
  console.log("parseCodeReviewCommand called with:", message);
  const trimmed = message.trim();
  
  // Check if message starts with "Codereview:" or "CodeReview:" (case insensitive)
  const regex = /^code ?review:/i;
  const matches = regex.test(trimmed);
  console.log("Regex test result:", matches, "using regex:", regex.toString());
  
  if (!matches) {
    console.log("Not a code review command, returning null");
    return null;
  }
  
  console.log("Detected code review command in message");
  
  // Extract the command (everything before the first space after "Codereview:")
  const parts = trimmed.split(/\s+(.+)/);
  const command = parts[0]; // "Codereview:" or "CodeReview:"
  const args = parts[1] || ""; // Rest of the message or empty string
  
  console.log("Parsed command parts:", { command, args });
  return { command, args };
}

/**
 * Formats code for review with the LLM
 * Takes the code collection result and formats it with the user's request
 */
export function formatCodeReviewPrompt(reviewRequest: string, codeResult: CollectionResult): string {
  console.log("formatCodeReviewPrompt called with review request:", reviewRequest);
  console.log("Code result summary:", {
    fileCount: codeResult.includedPaths.length,
    tokenCount: codeResult.totalTokens,
    combinedContentLength: codeResult.combinedContent.length
  });
  
  try {
    // Create a summary of the collected code files
    const filesSummary = `I've analyzed ${codeResult.includedPaths.length} files with approximately ${codeResult.totalTokens.toLocaleString()} tokens.`;
    
    // Add file types information if we have files
    let fileTypesInfo = '';
    if (codeResult.includedPaths.length > 0) {
      const extensions = new Map<string, number>();
      codeResult.includedPaths.forEach(filePath => {
        const ext = pathUtils.extname(filePath).toLowerCase() || '(no extension)';
        extensions.set(ext, (extensions.get(ext) || 0) + 1);
      });
      
      const fileTypesList = Array.from(extensions.entries())
        .sort((a, b) => b[1] - a[1]) // Sort by count, descending
        .map(([ext, count]) => `${ext}: ${count}`)
        .join(', ');
      
      fileTypesInfo = `\nFile types: ${fileTypesList}`;
    }
    
    // Check if we need to limit the tokens to prevent API errors
    // Different models have different token limits
    const DEFAULT_MAX_TOKENS = 300000; // Higher limit for Gemini by default
    const FALLBACK_MAX_TOKENS = 4000; // Conservative limit for other models
    
    // Use the higher limit by default (assuming Gemini)
    const MAX_TOKENS = DEFAULT_MAX_TOKENS;
    let codeSample = codeResult.combinedContent;
    
    // No truncation needed for Gemini models
    if (codeResult.totalTokens <= MAX_TOKENS) {
      console.log(`Token count (${codeResult.totalTokens}) within limit (${MAX_TOKENS}). Using full code sample.`);
    }
    
    // Create the full prompt
    const fullPrompt = `${reviewRequest}\n\n${filesSummary}${fileTypesInfo}\n\nHere is a sample of the code to review:\n${codeSample}`;
    console.log("Created prompt with length:", fullPrompt.length, "characters");
    return fullPrompt;
  } catch (error) {
    console.error('Error formatting code review prompt:', error);
    return `${reviewRequest}\n\nError formatting code summary: ${error instanceof Error ? error.message : 'Unknown error'}\n\nHere is the code to review:\n${codeResult.combinedContent}`;
  }
}