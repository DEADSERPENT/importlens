# Python Test File
from __future__ import annotations
import os
import sys
import json
from typing import List, Dict, Optional

# Using: sys, List, Dict
# Unused: os, json, Optional

def process_data(items: List[str]) -> Dict[str, int]:
    result: Dict[str, int] = {}
    for item in items:
        result[item] = len(item)
    print(f"Processed {len(items)} items", file=sys.stderr)
    return result
