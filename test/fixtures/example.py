# Example Python file with unused imports
# Use this to test the Smart Import Cleaner extension

import os
import sys
import json
import datetime
from typing import List, Dict, Optional, Tuple
from pathlib import Path

def greet(name: str) -> str:
    """Simple greeting function that only uses str type"""
    return f"Hello, {name}!"

def main():
    message = greet("World")
    print(message)

if __name__ == "__main__":
    main()

# Unused imports in this file:
# - os
# - sys
# - json
# - datetime
# - List
# - Dict
# - Optional
# - Tuple
# - Path
