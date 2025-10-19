/**
 * Console Override Utility
 * Disables console methods in production environment to prevent sensitive data exposure
 */

export const initializeConsoleOverride = () => {
  // Only override in production environment
  if (process.env.NODE_ENV === 'production') {
    // Store original console methods for potential debugging
    const originalConsole = {
      log: console.log,
      error: console.error,
      warn: console.warn,
      info: console.info,
      debug: console.debug,
      trace: console.trace,
      table: console.table,
      group: console.group,
      groupCollapsed: console.groupCollapsed,
      groupEnd: console.groupEnd,
      time: console.time,
      timeEnd: console.timeEnd,
      count: console.count,
      clear: console.clear
    };

    // Override console methods with empty functions
    console.log = () => {};
    console.error = () => {};
    console.warn = () => {};
    console.info = () => {};
    console.debug = () => {};
    console.trace = () => {};
    console.table = () => {};
    console.group = () => {};
    console.groupCollapsed = () => {};
    console.groupEnd = () => {};
    console.time = () => {};
    console.timeEnd = () => {};
    console.count = () => {};
    console.clear = () => {};

    // Optional: Add a warning for developers trying to use console in production
    Object.defineProperty(window, 'console', {
      get() {
        return {
          log: () => {},
          error: () => {},
          warn: () => {},
          info: () => {},
          debug: () => {},
          trace: () => {},
          table: () => {},
          group: () => {},
          groupCollapsed: () => {},
          groupEnd: () => {},
          time: () => {},
          timeEnd: () => {},
          count: () => {},
          clear: () => {}
        };
      },
      set() {
        // Prevent console from being reassigned
        return false;
      }
    });

    // Store original methods in a secure location for emergency debugging
    (window as unknown as Record<string, unknown>).__originalConsole = originalConsole;
  }
};

// Development helper to restore console (only works in development)
export const restoreConsole = () => {
  if (process.env.NODE_ENV !== 'production' && (window as unknown as Record<string, unknown>).__originalConsole) {
    const original = (window as unknown as Record<string, unknown>).__originalConsole as typeof console;
    console.log = original.log;
    console.error = original.error;
    console.warn = original.warn;
    console.info = original.info;
    console.debug = original.debug;
    console.trace = original.trace;
    console.table = original.table;
    console.group = original.group;
    console.groupCollapsed = original.groupCollapsed;
    console.groupEnd = original.groupEnd;
    console.time = original.time;
    console.timeEnd = original.timeEnd;
    console.count = original.count;
    console.clear = original.clear;
  }
};
