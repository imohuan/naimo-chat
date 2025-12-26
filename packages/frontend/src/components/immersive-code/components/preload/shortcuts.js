(function () {
  function handleKeyDown(event) {
    // ESC: Exit element selector mode if active
    if (event.key === "Escape" || event.keyCode === 27) {
      // Check if element selector is active
      const selector = window.__elementSelector;
      if (selector && selector.isActive) {
        // Disable selector
        if (selector.disable) {
          selector.disable();
        }
        // Notify parent to update state
        window.parent.postMessage(
          {
            type: "toggle-element-selector",
            enabled: false,
          },
          "*"
        );
        event.preventDefault();
        event.stopPropagation();
      }
    }

    // Ctrl+` or Cmd+`: Toggle console
    if (
      (event.ctrlKey || event.metaKey) &&
      (event.key === "`" || event.keyCode === 192)
    ) {
      window.parent.postMessage(
        {
          type: "toggle-console",
        },
        "*"
      );
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Add keyboard event listener
  // Use capture phase to catch events early
  document.addEventListener("keydown", handleKeyDown, true);
})();
