# Kapi Lite

<div align="center">
  <img src="public/assets/logos/icon.png" alt="Kapi Lite Logo" width="200"/>
  <h3>Your AI-Powered Development Companion</h3>
  <p><em>Code smarter, build faster, learn deeper</em></p>
</div>

## Vision

Kapi Lite is revolutionizing the way developers interact with their code. By bringing advanced AI capabilities directly into your development workflow, we're creating a more intuitive, efficient, and enlightening coding experience. Think of it as having a senior developer, technical architect, and coding mentor - all rolled into one intelligent companion.

### 🌟 Key Features

- **Intelligent Code Reviews**: Get instant, AI-powered code reviews that go beyond syntax - understanding context, patterns, and potential improvements
- **Real-time Development Assistance**: Interactive chat interface for immediate help with coding questions, debugging, and architecture decisions
- **Local-First Architecture**: Your code stays on your machine, with secure, privacy-focused AI integration
- **Cross-Platform Support**: Seamlessly works on Windows, macOS, and Linux
- **Smart Context Understanding**: Analyzes your codebase to provide relevant, contextual suggestions

## Quick Start

1. Clone the repository
2. Install dependencies: `npm install`
3. Start the application: `npm start`

## 🔒 Privacy & Security

Kapi Lite is built with a privacy-first approach:
- All code analysis happens locally on your machine
- Selective code sharing with AI - you control what gets shared
- No data storage or collection
- Open source and transparent

## Technical Implementation

### Code Review System

The code review functionality is integrated directly into the Chat interface for a seamless experience:

1. **Trigger via Chat Command**:
   - Start with `CodeReview:` (case insensitive)
   - Add your review request
   - Example: `CodeReview: Check for security vulnerabilities in my authentication code`

2. **Directory Selection**:
   - Select directories for analysis
   - Automatic filtering of non-code files
   - Smart context gathering

3. **AI Analysis**:
   - Comprehensive code review
   - Actionable improvement suggestions
   - Pattern recognition and best practices

### Architecture

#### Directory Permission System
1. **Permission Collection**
   - User-selected directory analysis
   - Persistent permission management
   - Intuitive permission UI

2. **Security Layer**
   - Validated file operations
   - Protected system directories
   - Secure access patterns

#### File System Integration
1. **Smart Scanning**
   - Recursive directory analysis
   - .gitignore respect
   - Quick access indexing

2. **Content Analysis**
   - Structure extraction
   - Complexity analysis
   - Change detection

#### LLM Integration
1. **Processing Pipeline**
   - Contextual bundling
   - Smart prompt generation
   - Efficient API integration

2. **Result Presentation**
   - Inline suggestions
   - Actionable feedback
   - User interaction system

## Contributing

We welcome contributions! Whether it's:
- 🐛 Bug fixes
- ✨ New features
- 📚 Documentation
- 🎨 UI/UX improvements

Check our [Contributing Guidelines](CONTRIBUTING.md) to get started.

## License

MIT License - See [LICENSE](LICENSE) for details.

---

<div align="center">
  <p>Built with ❤️ by the Kapi IDE Team</p>
  <p>Making development more intuitive, one line at a time.</p>
</div>