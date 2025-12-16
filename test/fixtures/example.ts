// Example TypeScript file with unused imports
// Use this to test the Smart Import Cleaner extension

import { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import { debounce, throttle, isEmpty } from 'lodash';
import moment from 'moment';

// Only useState is actually used
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={() => setCount(count + 1)}>
        Increment
      </button>
    </div>
  );
}

export default Counter;

// Unused imports in this file:
// - useEffect
// - useMemo
// - useCallback
// - axios
// - debounce
// - throttle
// - isEmpty
// - moment
