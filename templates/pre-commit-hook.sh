#!/bin/bash

# ImportLens Pre-commit Hook
# Checks for unused imports before allowing commit

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}Running ImportLens check...${NC}"

# Get staged files
STAGED_FILES=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.(ts|tsx|js|jsx|py|java|go|rs|cpp|cc|c|h)$')

if [ -z "$STAGED_FILES" ]; then
  echo -e "${GREEN}No relevant files to check${NC}"
  exit 0
fi

# Check if importlens-cli is available
if ! command -v npx &> /dev/null; then
  echo -e "${RED}npx not found. Please install Node.js${NC}"
  exit 1
fi

# Run ImportLens on staged files
TEMP_OUTPUT=$(mktemp)
echo "$STAGED_FILES" | xargs npx importlens-cli --check --format=text > "$TEMP_OUTPUT" 2>&1
EXIT_CODE=$?

if [ $EXIT_CODE -ne 0 ]; then
  echo -e "${RED}❌ ImportLens found unused imports:${NC}\n"
  cat "$TEMP_OUTPUT"
  echo -e "\n${YELLOW}Options:${NC}"
  echo "  1. Run 'npx importlens-cli --fix' to automatically remove unused imports"
  echo "  2. Manually remove the unused imports"
  echo "  3. Use 'git commit --no-verify' to bypass this check (not recommended)"
  rm "$TEMP_OUTPUT"
  exit 1
else
  echo -e "${GREEN}✓ No unused imports found${NC}"
  rm "$TEMP_OUTPUT"
  exit 0
fi
