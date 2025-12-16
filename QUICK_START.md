# Quick Start Guide

## Testing the Extension

### Step 1: Run the Extension in Development Mode

1. Open this project in VS Code
2. Press **F5** to launch the Extension Development Host
3. A new VS Code window will open with your extension loaded

### Step 2: Create a Test File

In the new window, create a test file with unused imports:

**TypeScript/JavaScript Example:**
```typescript
// test.ts
import { useState, useEffect, useMemo } from 'react';
import axios from 'axios';
import { debounce } from 'lodash';

function Component() {
  const [count, setCount] = useState(0);
  return <div>{count}</div>;
}
```

In this example:
- `useEffect`, `useMemo` are unused
- `axios` is unused
- `debounce` is unused

**Python Example:**
```python
# test.py
import os
import sys
import json
from typing import List, Dict, Optional

def hello():
    print("Hello world")
```

In this example:
- `os`, `sys`, `json` are all unused
- `List`, `Dict`, `Optional` are all unused

### Step 3: See the Extension in Action

1. **Wait for diagnostics**: After creating the file, wait a few seconds for the language server to analyze it
2. **Unused imports will be dimmed**: You should see unused imports with a strikethrough and opacity
3. **Hover for explanation**: Hover over a dimmed import to see why it's unused

### Step 4: Clean Imports

#### Option 1: Command Palette
1. Press **Ctrl+Shift+P** (Windows/Linux) or **Cmd+Shift+P** (Mac)
2. Type "Smart Import Cleaner: Clean Current File"
3. Press Enter
4. Confirm the removal

#### Option 2: Enable Auto-Clean on Save
1. Open Settings: **Ctrl+,** (Windows/Linux) or **Cmd+,** (Mac)
2. Search for "Smart Import Cleaner"
3. Enable "Enable On Save"
4. Now when you save any file, unused imports are automatically removed

### Step 5: Try Different Languages

Create test files in different languages to see the universal support:

**Java:**
```java
// Test.java
import java.util.List;
import java.util.ArrayList;
import java.util.HashMap;

public class Test {
    public static void main(String[] args) {
        List<String> list = new ArrayList<>();
    }
}
// HashMap is unused
```

**Go:**
```go
// test.go
package main

import (
    "fmt"
    "os"
    "time"
)

func main() {
    fmt.Println("Hello")
}
// os and time are unused
```

**Rust:**
```rust
// test.rs
use std::collections::HashMap;
use std::io::Read;
use std::fs::File;

fn main() {
    let mut map = HashMap::new();
    map.insert("key", "value");
}
// Read and File are unused
```

## Available Commands

Open Command Palette (**Ctrl+Shift+P**) and search for:

1. **Smart Import Cleaner: Clean Current File** - Remove unused imports from active file
2. **Smart Import Cleaner: Clean Workspace** - Remove unused imports from all files
3. **Smart Import Cleaner: Show Statistics** - View statistics about unused imports
4. **Smart Import Cleaner: Toggle Safe Mode** - Switch between safe and aggressive modes

## Configuration Options

Access via **Settings** → Search "Smart Import Cleaner":

- **Enable On Save**: Auto-clean when saving files
- **Safe Mode**: Preserve side-effect imports (recommended)
- **Show Explanation Tooltip**: Show hover tooltips
- **Show Diff Before Apply**: Preview changes before applying
- **Excluded Languages**: Languages to skip
- **Exclude Patterns**: File patterns to skip

## Troubleshooting

### No imports are highlighted
- **Solution**: Wait for the language server to analyze the file (can take 5-10 seconds)
- Check that you have the language extension installed (e.g., Python extension for .py files)

### Clean command doesn't work
- **Solution**: Make sure there are actually unused imports (hover to see diagnostics)
- Check that Safe Mode isn't blocking removal of side-effect imports

### Extension not loading
- **Solution**: Check the Debug Console in the Extension Development Host for errors
- Make sure you compiled the TypeScript: `npm run compile`

## Packaging the Extension

To create a `.vsix` file for installation:

```bash
# Install vsce if you haven't
npm install -g @vscode/vsce

# Package the extension
vsce package

# Install the packaged extension
code --install-extension smart-import-cleaner-0.0.1.vsix
```

## Next Steps

1. Test with your real projects
2. Try different languages
3. Adjust settings to your preference
4. Report bugs or request features on GitHub
5. Contribute language adapters for more languages!

## Development Workflow

```bash
# Install dependencies
npm install

# Compile TypeScript
npm run compile

# Watch mode (auto-compile on changes)
npm run watch

# Run tests (if implemented)
npm test

# Package extension
vsce package
```

## Project Structure

```
smart-import-cleaner/
├── src/
│   ├── adapters/          # Language-specific adapters
│   │   ├── LanguageAdapter.ts
│   │   ├── TypeScriptAdapter.ts
│   │   ├── PythonAdapter.ts
│   │   └── GenericLSPAdapter.ts
│   ├── core/              # Core functionality
│   │   ├── ImportAnalyzer.ts
│   │   ├── SafeEditExecutor.ts
│   │   └── DiagnosticListener.ts
│   └── extension.ts       # Entry point
├── out/                   # Compiled JavaScript
├── package.json          # Extension manifest
└── tsconfig.json         # TypeScript config
```

