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
      "border: 2px solid #4A90E2; background: rgba(74, 144, 226, 0.1); " +
      "box-sizing: border-box; display: none;";
    document.body.appendChild(highlightOverlay);
    return highlightOverlay;
  }

  function createSelectorLabel() {
    if (selectorLabel) return selectorLabel;

    selectorLabel = document.createElement("div");
    selectorLabel.style.cssText =
      "position: absolute; z-index: 1000000; " +
      "background: #4A90E2; color: white; " +
      "padding: 4px 8px; font-size: 11px; " +
      "font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', 'Consolas', 'Courier New', monospace; " +
      "font-weight: 400; letter-spacing: 0; " +
      "border-radius: 2px; white-space: nowrap; " +
      "pointer-events: auto; cursor: pointer; " +
      "box-shadow: 0 2px 4px rgba(0,0,0,0.2); " +
      "max-width: 300px; overflow: hidden; text-overflow: ellipsis; " +
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

  function getElementSelector(element) {
    if (!element || element === document.body || element === document.documentElement) {
      return "";
    }

    // Get element tag and classes
    const tag = element.tagName.toLowerCase();
    const classes = element.className
      ? "." +
      element.className
        .split(" ")
        .filter((c) => c)
        .join(".")
      : "";
    const id = element.id ? "#" + element.id : "";
    return tag + id + classes;
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
      textContent: element.textContent ? element.textContent.trim().substring(0, 100) : null,
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

    const selector = getElementSelector(element);
    label.textContent = selector;

    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    // Temporarily show label to measure its height
    label.style.display = "block";
    label.style.visibility = "hidden";
    const labelHeight = label.offsetHeight;
    const labelWidth = label.offsetWidth;
    label.style.visibility = "visible";

    // Check if there's enough space at the top (at least label height + some padding)
    const minTopSpace = labelHeight + 4;
    const topSpace = rect.top + scrollY;
    const canShowOnTop = topSpace >= minTopSpace;

    // Position at top-left corner (inside left by 2px for border)
    label.style.left = rect.left + scrollX + 2 + "px";

    if (canShowOnTop) {
      // Show above the element
      label.style.top = rect.top + scrollY + "px";
      label.style.transform = "translateY(-100%)";
      label.style.marginTop = "-2px";
    } else {
      // Show inside the element at the top
      label.style.top = rect.top + scrollY + 2 + "px";
      label.style.transform = "none";
      label.style.marginTop = "0";
    }

    // Ensure label doesn't overflow horizontally
    const maxLeft = rect.left + rect.width - labelWidth - 2;
    if (parseInt(label.style.left) > maxLeft) {
      label.style.left = Math.max(rect.left + scrollX + 2, maxLeft) + "px";
    }

    label.style.display = "block";
  }

  function highlightElement(element) {
    if (!isSelectorActive) return;

    const overlay = createHighlightOverlay();

    if (!element || element === document.body || element === document.documentElement) {
      overlay.style.display = "none";
      updateSelectorLabel(null, null);
      return;
    }

    const rect = element.getBoundingClientRect();
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;

    overlay.style.left = rect.left + scrollX + "px";
    overlay.style.top = rect.top + scrollY + "px";
    overlay.style.width = rect.width + "px";
    overlay.style.height = rect.height + "px";
    overlay.style.display = "block";

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
    overlay.style.display = "none";
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
      highlightOverlay.style.display = "none";
    }
    if (selectorLabel) {
      selectorLabel.style.display = "none";
    }
    currentHighlight = null;
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
