#!/usr/bin/env node

const jestMatchersSymbol = Symbol.for('$$jest-matchers-object');

const originalDefineProperty = Object.defineProperty;
Object.defineProperty = function patchedDefineProperty(target, property, descriptor) {
  if (target === globalThis && property === jestMatchersSymbol) {
    descriptor = { configurable: true, ...descriptor };
  }
  return originalDefineProperty(target, property, descriptor);
};

import('@playwright/test/cli').catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
