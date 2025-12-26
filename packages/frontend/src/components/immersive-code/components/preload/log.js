(function () {
  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info
  };

  function sendLog(method, args) {
    try {
      // Check if any argument is an Error object with stack
      let errorStack = null;
      const hasError = args.some(arg => arg instanceof Error && arg.stack);
      if (hasError) {
        // Find the first Error object with stack
        const errorArg = args.find(arg => arg instanceof Error && arg.stack);
        if (errorArg && errorArg.stack) {
          errorStack = errorArg.stack;
        }
      }

      // Capture caller information from current stack
      const stack = new Error().stack;
      let caller = 'unknown';
      let stackTrace = '';

      if (stack) {
        const stackLines = stack.split('\\n');
        // Find the caller (usually the 3rd line, skip Error and sendLog)
        if (stackLines.length > 2) {
          const callerLine = stackLines[2] || stackLines[1];
          if (callerLine) {
            // Extract function/file info from stack line
            const match = callerLine.match(/at\\s+(.+?)\\s+\\((.+?):(\\d+):(\\d+)\\)/) ||
              callerLine.match(/at\\s+(.+?)\\s+(.+?):(\\d+):(\\d+)/) ||
              callerLine.match(/at\\s+(.+)/);
            if (match) {
              caller = (match[1] || match[0]).trim();
            }
          }
          // Get full stack trace (skip first line: Error, keep sendLog for context)
          // Include all lines after Error for complete stack trace
          stackTrace = stackLines.slice(1).join('\\n');
        } else if (stackLines.length > 1) {
          // If only 2 lines, still include them
          stackTrace = stackLines.slice(1).join('\\n');
        }
      }

      // If we have an Error stack, use it instead (it's more complete)
      if (errorStack) {
        stackTrace = errorStack;
        // Extract caller from error stack if possible
        const errorStackLines = errorStack.split('\\n');
        if (errorStackLines.length > 1) {
          const errorCallerLine = errorStackLines[1];
          const match = errorCallerLine.match(/at\\s+(.+?)\\s+\\((.+?):(\\d+):(\\d+)\\)/) ||
            errorCallerLine.match(/at\\s+(.+?)\\s+(.+?):(\\d+):(\\d+)/) ||
            errorCallerLine.match(/at\\s+(.+)/);
          if (match) {
            caller = (match[1] || match[0]).trim();
          }
        }
      }

      // Simple serialization to pass across iframe boundary
      const serializedArgs = args.map(arg => {
        if (typeof arg === 'undefined') return 'undefined';
        if (arg === null) return 'null';
        if (typeof arg === 'function') return arg.toString();
        if (arg instanceof Error) {
          return {
            message: arg.message,
            stack: arg.stack || ''
          };
        }
        try {
          return JSON.parse(JSON.stringify(arg));
        } catch (e) {
          return String(arg);
        }
      });

      window.parent.postMessage({
        type: 'console-log',
        method,
        args: serializedArgs,
        caller: caller,
        stack: stackTrace
      }, '*');
    } catch (err) {
      console.error('Failed to send log to parent', err);
    }
  }

  console.log = (...args) => { originalConsole.log(...args); sendLog('log', args); };
  console.warn = (...args) => { originalConsole.warn(...args); sendLog('warn', args); };
  console.error = (...args) => { originalConsole.error(...args); sendLog('error', args); };
  console.info = (...args) => { originalConsole.info(...args); sendLog('info', args); };

  window.addEventListener('error', (event) => {
    sendLog('error', [event.message]);
  });
})();