"use strict";
// Example JavaScript file with unused imports
// Use this to test the Smart Import Cleaner extension

const React = require("react");
const { useState, useEffect, useMemo, useCallback } = require("react");
const axios = require("axios");
const { debounce, throttle, isEmpty } = require("lodash");
const moment = require("moment");

// Only useState is actually used
function Counter() {
  const [count, setCount] = useState(0);

  return React.createElement(
    "div",
    null,
    React.createElement("p", null, "Count: ", count),
    React.createElement(
      "button",
      { onClick: () => setCount(count + 1) },
      "Increment"
    )
  );
}

module.exports = Counter;

// Unused imports in this file:
// - useEffect
// - useMemo
// - useCallback
// - axios
// - debounce
// - throttle
// - isEmpty
// - moment
