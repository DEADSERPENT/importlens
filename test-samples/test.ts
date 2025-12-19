// TypeScript Test File
import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import { debounce, throttle } from 'lodash';
import './styles.css';

// Using: React, useState, debounce, styles.css
// Unused: useEffect, useCallback, throttle

export function TestComponent() {
  const [count, setCount] = useState(0);

  const handleClick = debounce(() => {
    setCount(count + 1);
  }, 300);

  return <div onClick={handleClick}>Count: {count}</div>;
}
