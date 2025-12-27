(function () {
  let isSelectorActive = false;
  let currentHighlight = null;
  let highlightOverlay = null;
  let selectorLabel = null;

  function createHighlightOverlay() {
    if (highlightOverlay) return highlightOverlay;

    highlightOverlay = document.createElement("div");
    highlightOverlay.style.cssText =
      "position: absolute; pointer-events: none; z-index: 999999; " +
      "border: 2px solid #2563EB; background: rgba(37, 99, 235, 0.2); " +
      "box-sizing: border-box; display: none; " +
      "transition: left 0.15s ease-out, top 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out, opacity 0.15s ease-out; " +
      "opacity: 0;";
    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }

  function createSelectorLabel() {
    if (selectorLabel) return selectorLabel;

    selectorLabel = document.createElement("div");
    selectorLabel.style.cssText =
      "position: absolute; z-index: 1000000; " +
      "background: #2563EB; color: white; " +
      "padding: 4px 8px; font-size: 11px; " +
      "font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', 'Consolas', 'Courier New', monospace; " +
      "font-weight: 400; letter-spacing: 0; " +
      "border-radius: 2px; white-space: nowrap; " +
      "pointer-events: auto; cursor: pointer; " +
      "box-shadow: 0 2px 4px rgba(0,0,0,0.2); " +
      "max-width: 300px; overflow: hidden; text-overflow: ellipsis; " +
      "transition: left 0.15s ease-out, top 0.15s ease-out, transform 0.15s ease-out; " +
      "display: none;";
    document.body.appendChild(selectorLabel);

    // Add click handler
    selectorLabel.addEventListener("click", function (e) {
      e.stopPropagation();
      if (currentHighlight) {
        const elementData = getElementData(currentHighlight);
        window.parent.postMessage(
          {
            type: "element-selected",
            selector: elementData ? elementData.selector : "",
            data: elementData,
          },
          "*"
        );
        // Disable selector after element is selected
        disableSelector();
        // Notify parent that selector is disabled
        window.parent.postMessage(
          {
            type: "toggle-element-selector",
            enabled: false,
          },
          "*"
        );
      }
    });

    return selectorLabel;
  }

  // Escape CSS selector special characters
  function escapeSelector(str) {
    if (!str) return "";
    return str.replace(/([!"#$%&'()*+,.:;<=>?@[\\\]^`{|}~])/g, "\\$1");
  }

  // Get nth-child index of element among siblings of same tag
  function getNthChildIndex(element) {
    const parent = element.parentElement;
    if (!parent) return 1;

    const tag = element.tagName.toLowerCase();
    let index = 1;
    for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {
      if (sibling.tagName.toLowerCase() === tag) {
        index++;
      }
    }
    return index;
  }

  // Generate a unique selector for an element
  function getElementSelector(element) {
    if (!element || element === document.body || element === document.documentElement) {
      return "";
    }

    // If element has a unique ID, use it (fastest and most reliable)
    if (element.id) {
      const idSelector = "#" + escapeSelector(element.id);
      try {
        const matches = document.querySelectorAll(idSelector);
        if (matches.length === 1 && matches[0] === element) {
          return idSelector;
        }
      } catch {
        // Invalid selector, continue with other methods
      }
    }

    // Build path from element to root
    const path = [];
    let current = element;

    while (current && current !== document.body && current !== document.documentElement) {
      let selector = current.tagName.toLowerCase();

      // Add ID if available
      if (current.id) {
        selector += "#" + escapeSelector(current.id);
        path.unshift(selector);
        // If we have an ID, we can stop here (assuming IDs are unique)
        // But verify it's unique first
        try {
          const idSelector = "#" + escapeSelector(current.id);
          const matches = document.querySelectorAll(idSelector);
          if (matches.length === 1) {
            break;
          }
        } catch {
          // Continue building path
        }
      } else {
        // Add classes if available
        if (current.className && typeof current.className === "string") {
          const classes = current.className
            .split(" ")
            .filter((c) => c && c.trim())
            .map((c) => "." + escapeSelector(c))
            .join("");
          if (classes) {
            selector += classes;
          }
        }

        // Add nth-child for uniqueness
        const nth = getNthChildIndex(current);
        selector += ":nth-of-type(" + nth + ")";

        path.unshift(selector);
      }

      current = current.parentElement;
    }

    // Join path segments
    const fullSelector = path.join(" > ");

    // Verify the selector is unique
    try {
      const matches = document.querySelectorAll(fullSelector);
      if (matches.length === 1 && matches[0] === element) {
        return fullSelector;
      }
    } catch {
      // Selector might be invalid, try simpler approach
    }

    // Fallback: try with just tag and nth-child
    const simplePath = [];
    current = element;
    while (current && current !== document.body && current !== document.documentElement) {
      const tag = current.tagName.toLowerCase();
      const nth = getNthChildIndex(current);
      simplePath.unshift(tag + ":nth-of-type(" + nth + ")");
      current = current.parentElement;
    }

    const simpleSelector = simplePath.join(" > ");
    try {
      const matches = document.querySelectorAll(simpleSelector);
      if (matches.length === 1 && matches[0] === element) {
        return simpleSelector;
      }
    } catch {
      // Last resort fallback
    }

    // Last resort: return the original simple selector
    return fullSelector || simpleSelector;
  }

  function getElementData(element) {
    if (!element || element === document.body || element === document.documentElement) {
      return null;
    }

    const rect = element.getBoundingClientRect();
    const styles = window.getComputedStyle(element);

    return {
      selector: getElementSelector(element),
      tagName: element.tagName.toLowerCase(),
      id: element.id || null,
      className: element.className || null,
      classList: element.className ? element.className.split(" ").filter((c) => c) : [],
      textContent: element.textContent
        ? element.textContent.trim().substring(0, 100)
        : null,
      innerHTML: element.innerHTML ? element.innerHTML.substring(0, 200) : null,
      attributes: Array.from(element.attributes).reduce((acc, attr) => {
        acc[attr.name] = attr.value;
        return acc;
      }, {}),
      position: {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
        top: rect.top,
        left: rect.left,
        right: rect.right,
        bottom: rect.bottom,
      },
      styles: {
        display: styles.display,
        position: styles.position,
        visibility: styles.visibility,
        opacity: styles.opacity,
        zIndex: styles.zIndex,
        color: styles.color,
        backgroundColor: styles.backgroundColor,
        fontSize: styles.fontSize,
        fontFamily: styles.fontFamily,
      },
    };
  }

  function updateSelectorLabel(element, rect) {
    const label = createSelectorLabel();
    if (!element || element === document.body || element === document.documentElement) {
      label.style.display = "none";
      return;
    }

    // Display only tagName instead of selector
    const tagName = element.tagName.toLowerCase();
    // Only update text if it changed to avoid unnecessary reflows
    if (label.textContent !== tagName) {
      label.textContent = tagName;
    }

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Ensure label is visible for measurement
    if (label.style.display === "none") {
      label.style.display = "block";
      label.style.visibility = "hidden";
    }

    // Measure label dimensions
    const labelHeight = label.offsetHeight || label.scrollHeight;
    const labelWidth = label.offsetWidth || label.scrollWidth;
    label.style.visibility = "visible";

    // Check if there's enough space at the top (at least label height + some padding)
    const minTopSpace = labelHeight + 4;
    const topSpace = rect.top + scrollY;
    const canShowOnTop = topSpace >= minTopSpace;

    // Calculate position - align label left edge with element left edge
    let labelLeft = rect.left + scrollX;
    let labelTop = rect.top + scrollY;

    if (canShowOnTop) {
      // Show above the element
      labelTop = rect.top + scrollY;
      label.style.transform = "translateY(-100%)";
      label.style.marginTop = "0px";
    } else {
      // Show inside the element at the top
      labelTop = rect.top + scrollY;
      label.style.transform = "none";
      label.style.marginTop = "0px";
    }

    // Ensure label doesn't overflow horizontally
    const maxLeft = rect.left + scrollX + rect.width - labelWidth;
    if (labelLeft > maxLeft) {
      labelLeft = Math.max(rect.left + scrollX, maxLeft);
    }

    // Update position with smooth transition
    label.style.left = labelLeft + "px";
    label.style.top = labelTop + "px";
    label.style.display = "block";
  }

  function highlightElement(element) {
    if (!isSelectorActive) return;

    const overlay = createHighlightOverlay();

    if (!element || element === document.body || element === document.documentElement) {
      overlay.style.opacity = "0";
      overlay.style.display = "none";
      updateSelectorLabel(null, null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Calculate exact position to match element (overlay floats above the element)
    const left = rect.left + scrollX;
    const top = rect.top + scrollY;
    const width = rect.width;
    const height = rect.height;

    // Set position and size with smooth transition
    overlay.style.left = left + "px";
    overlay.style.top = top + "px";
    overlay.style.width = width + "px";
    overlay.style.height = height + "px";

    // Show overlay with fade-in animation
    if (overlay.style.display === "none") {
      overlay.style.display = "block";
      // Trigger reflow to ensure transition works
      void overlay.offsetHeight;
    }
    overlay.style.opacity = "1";

    updateSelectorLabel(element, rect);
    currentHighlight = element;
  }

  function handleMouseMove(e) {
    if (!isSelectorActive) return;

    // Get all elements at the point (using elementsFromPoint to get all layers)
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    if (!elements || elements.length === 0) return;

    // Find the first element that is not our overlay or label
    let targetElement = null;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      // Skip our overlay and label elements
      if (el === highlightOverlay || el === selectorLabel) {
        continue;
      }
      // Skip if element is a child of overlay or label
      if (highlightOverlay && highlightOverlay.contains(el)) {
        continue;
      }
      if (selectorLabel && selectorLabel.contains(el)) {
        continue;
      }
      // Skip body and html
      if (el === document.body || el === document.documentElement) {
        continue;
      }
      targetElement = el;
      break;
    }

    if (targetElement && targetElement !== currentHighlight) {
      highlightElement(targetElement);
    }
  }

  function handleMouseLeave() {
    if (!isSelectorActive) return;
    const overlay = createHighlightOverlay();
    overlay.style.opacity = "0";
    // Hide after transition completes
    setTimeout(() => {
      if (overlay.style.opacity === "0") {
        overlay.style.display = "none";
      }
    }, 150);
    updateSelectorLabel(null, null);
    currentHighlight = null;
  }

  function handleClick(e) {
    if (!isSelectorActive) return;

    // Don't handle clicks on the label (it has its own handler)
    if (selectorLabel && selectorLabel.contains(e.target)) {
      return;
    }

    // Don't handle clicks on the overlay
    if (highlightOverlay && highlightOverlay.contains(e.target)) {
      return;
    }

    // Get the element that was clicked
    const elements = document.elementsFromPoint(e.clientX, e.clientY);
    if (!elements || elements.length === 0) return;

    // Find the first element that is not our overlay or label
    let targetElement = null;
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el === highlightOverlay || el === selectorLabel) {
        continue;
      }
      if (highlightOverlay && highlightOverlay.contains(el)) {
        continue;
      }
      if (selectorLabel && selectorLabel.contains(el)) {
        continue;
      }
      if (el === document.body || el === document.documentElement) {
        continue;
      }
      targetElement = el;
      break;
    }

    if (targetElement) {
      e.preventDefault();
      e.stopPropagation();
      const elementData = getElementData(targetElement);
      window.parent.postMessage(
        {
          type: "element-selected",
          selector: elementData ? elementData.selector : "",
          data: elementData,
        },
        "*"
      );
      // Disable selector after element is selected
      disableSelector();
      // Notify parent that selector is disabled
      window.parent.postMessage(
        {
          type: "toggle-element-selector",
          enabled: false,
        },
        "*"
      );
    }
  }

  function enableSelector() {
    isSelectorActive = true;
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseleave", handleMouseLeave);
    document.addEventListener("click", handleClick, true); // Use capture phase
    createHighlightOverlay();
    createSelectorLabel();
    // Focus the window when selector is enabled
    window.focus();
  }

  function disableSelector() {
    isSelectorActive = false;
    document.removeEventListener("mousemove", handleMouseMove);
    document.removeEventListener("mouseleave", handleMouseLeave);
    document.removeEventListener("click", handleClick, true);

    if (highlightOverlay) {
      highlightOverlay.style.opacity = "0";
      // Hide after transition completes
      setTimeout(() => {
        if (highlightOverlay && highlightOverlay.style.opacity === "0") {
          highlightOverlay.style.display = "none";
        }
      }, 150);
    }
    if (selectorLabel) {
      selectorLabel.style.display = "none";
    }
    currentHighlight = null;
  }

  // Select element by selector and highlight it (without enabling selector mode)
  function selectElementBySelector(selector) {
    if (!selector) return;

    try {
      // Try to find element by selector
      let element = null;

      // Try querySelector first
      try {
        element = document.querySelector(selector);
      } catch (e) {
        console.warn("Failed to query selector:", selector, e);
      }

      // If not found, try to parse and find manually
      if (!element && selector) {
        // Parse selector: tag#id.class1.class2
        const parts = selector.match(/^([a-z]+)?(#[a-zA-Z0-9_-]+)?(\.[a-zA-Z0-9_-]+)*$/);
        if (parts) {
          const tag = parts[1] || "*";
          const id = parts[2] ? parts[2].substring(1) : null;
          const classes = parts[3] ? parts[3].split(".").filter((c) => c) : [];

          // Try to find by tag, id, and classes
          const candidates = document.querySelectorAll(tag);
          for (let i = 0; i < candidates.length; i++) {
            const el = candidates[i];
            let matches = true;

            if (id && el.id !== id) {
              matches = false;
            }

            if (matches && classes.length > 0) {
              const elClasses = el.className
                ? el.className.split(" ").filter((c) => c)
                : [];
              for (let j = 0; j < classes.length; j++) {
                if (!elClasses.includes(classes[j])) {
                  matches = false;
                  break;
                }
              }
            }

            if (matches) {
              element = el;
              break;
            }
          }
        }
      }

      if (element && element !== document.body && element !== document.documentElement) {
        // Highlight the element (similar to highlightElement but persistent)
        const overlay = createHighlightOverlay();
        const rect = element.getBoundingClientRect();
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;

        const left = rect.left + scrollX;
        const top = rect.top + scrollY;
        const width = rect.width;
        const height = rect.height;

        overlay.style.left = left + "px";
        overlay.style.top = top + "px";
        overlay.style.width = width + "px";
        overlay.style.height = height + "px";

        if (overlay.style.display === "none") {
          overlay.style.display = "block";
          void overlay.offsetHeight; // Trigger reflow
        }
        overlay.style.opacity = "1";

        updateSelectorLabel(element, rect);
        currentHighlight = element;

        // Scroll element into view
        element.scrollIntoView({ behavior: "smooth", block: "center" });

        // Add click handler to remove highlight when clicking outside
        function handleClickOutside(e) {
          // Check if click is outside the highlighted element
          const target = e.target;
          const isClickOnHighlight =
            currentHighlight &&
            (currentHighlight === target || currentHighlight.contains(target));
          const isClickOnOverlay =
            highlightOverlay &&
            (highlightOverlay === target || highlightOverlay.contains(target));
          const isClickOnLabel =
            selectorLabel && (selectorLabel === target || selectorLabel.contains(target));

          if (!isClickOnHighlight && !isClickOnOverlay && !isClickOnLabel) {
            // Remove highlight with fade-out animation
            if (highlightOverlay) {
              highlightOverlay.style.opacity = "0";
              setTimeout(() => {
                if (highlightOverlay && highlightOverlay.style.opacity === "0") {
                  highlightOverlay.style.display = "none";
                }
              }, 150);
            }
            if (selectorLabel) {
              selectorLabel.style.display = "none";
            }
            currentHighlight = null;
            // Remove this listener
            document.removeEventListener("click", handleClickOutside, true);
          }
        }

        // Add click listener to detect clicks outside (use capture phase to catch early)
        setTimeout(() => {
          document.addEventListener("click", handleClickOutside, true);
        }, 100);
      }
    } catch (e) {
      console.error("Error selecting element by selector:", e);
    }
  }

  // Listen for selector toggle messages
  window.addEventListener("message", function (event) {
    if (event.data && event.data.type === "toggle-element-selector") {
      if (event.data.enabled) {
        enableSelector();
      } else {
        disableSelector();
      }
    } else if (event.data && event.data.type === "focus-iframe") {
      // Focus the iframe window when requested
      window.focus();
    } else if (event.data && event.data.type === "select-element-by-selector") {
      // Select and highlight element by selector
      selectElementBySelector(event.data.selector);
    }
  });

  // Expose for direct access
  window.__elementSelector = {
    enable: enableSelector,
    disable: disableSelector,
    get isActive() {
      return isSelectorActive;
    },
  };
})();
