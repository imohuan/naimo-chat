import{$t as e,An as t,Bn as n,Dn as r,Gn as i,Jt as a,Kt as o,Lt as s,Mt as c,Nt as l,Qn as u,Un as d,Vn as f,Vt as p,Xn as m,Xt as h,Yn as g,Yt as _,cn as v,dn as y,en as b,gn as x,i as S,jn as C,ln as w,nn as T,pn as ee,qn as E,qt as D,rn as te,vn as O,yn as k}from"./index-urHyhAmF.js";import{d as A}from"./dist-DmajSpNV.js";import{u as j}from"./floating-ui.vue-C1NloyW1.js";import{A as ne,D as re,M as ie,T as ae,a as oe,b as se,i as ce,j as le,k as ue,n as de,p as fe,r as pe,t as me,w as M}from"./SelectValue-BI7pjivR.js";import{t as N}from"./chevron-down-ByDMAM3t.js";import{t as he}from"./code-xml-Du14q2GW.js";import{t as ge}from"./copy-RphYhh8Z.js";import{t as _e}from"./trash-2-l40C5gd0.js";import{t as ve}from"./x-CQcBFYia.js";import{F as P,c as F,d as I,f as L,i as R,l as z,o as B,t as V,u as H,y as U}from"./utils-jrYJ9m3X.js";import{n as W,t as ye}from"./CodeEditor-BYu0j6s-.js";var be=j(`history`,[[`path`,{d:`M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`1357e3`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}],[`path`,{d:`M12 7v5l4 2`,key:`1fdv2h`}]]),xe=j(`mouse-pointer-2`,[[`path`,{d:`M4.037 4.688a.495.495 0 0 1 .651-.651l16 6.5a.5.5 0 0 1-.063.947l-6.124 1.58a2 2 0 0 0-1.438 1.435l-1.579 6.126a.5.5 0 0 1-.947.063z`,key:`edeuup`}]]),Se=j(`redo-2`,[[`path`,{d:`m15 14 5-5-5-5`,key:`12vg1m`}],[`path`,{d:`M20 9H9.5A5.5 5.5 0 0 0 4 14.5A5.5 5.5 0 0 0 9.5 20H13`,key:`6uklza`}]]),Ce=j(`refresh-ccw`,[[`path`,{d:`M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8`,key:`14sxne`}],[`path`,{d:`M3 3v5h5`,key:`1xhq8a`}],[`path`,{d:`M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16`,key:`1hlbsb`}],[`path`,{d:`M16 16h5v5`,key:`ccwih5`}]]),we=j(`share-2`,[[`circle`,{cx:`18`,cy:`5`,r:`3`,key:`gq8acd`}],[`circle`,{cx:`6`,cy:`12`,r:`3`,key:`w7nqdw`}],[`circle`,{cx:`18`,cy:`19`,r:`3`,key:`1xt0gg`}],[`line`,{x1:`8.59`,x2:`15.42`,y1:`13.51`,y2:`17.49`,key:`47mynk`}],[`line`,{x1:`15.41`,x2:`8.59`,y1:`6.51`,y2:`10.49`,key:`1n3mei`}]]),Te=j(`terminal`,[[`path`,{d:`M12 19h8`,key:`baeox8`}],[`path`,{d:`m4 17 6-6-6-6`,key:`1yngyt`}]]),Ee=j(`undo-2`,[[`path`,{d:`M9 14 4 9l5-5`,key:`102s5s`}],[`path`,{d:`M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11`,key:`f3b9sd`}]]),G=j(`wrench`,[[`path`,{d:`M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.106-3.105c.32-.322.863-.22.983.218a6 6 0 0 1-8.259 7.057l-7.91 7.91a1 1 0 0 1-2.999-3l7.91-7.91a6 6 0 0 1 7.057-8.259c.438.12.54.662.219.984z`,key:`1ngwbx`}]]);function De(e=``){let t=f([]);e&&g(e);let i=f(0),a=f(0),s=o(()=>t.value[i.value]),c=o(()=>{let e=s.value;return e&&e.records?e.records[e.currentIndex]:null}),l=o(()=>c.value?.code||``),u=o(()=>c.value?.diffTarget),d=o(()=>{let e=s.value;return e?e.currentIndex>0:!1}),p=o(()=>{let e=s.value;return e&&e.records?e.currentIndex<e.records.length-1:!1});r([i,()=>s.value?.currentIndex,l,u],()=>{let e={MajorVersion:i.value,MinorIndex:s.value?.currentIndex,TotalRecords:s.value?.records.length,HasDiffTarget:!!u.value,CurrentCodeLen:l.value.length,DiffTargetLen:u.value?.length||0};console.groupCollapsed(`📜 [ImmersiveHistory] State Update`),console.table(e),console.log(`Current Record:`,c.value),console.groupEnd(),typeof window<`u`&&(window.__ImmersiveHistory__={versions:t.value,currentVersion:s.value,currentRecord:c.value,functions:{record:h,undo:v,redo:y,addMajorVersion:g,switchVersion:b}})},{deep:!0,immediate:!0});function m(){return Math.random().toString(36).substring(2,9)}function h(e,t,n){let r=c.value;if(r&&e===r.code&&t===r.diffTarget)return;let i=s.value;if(!i||!i.records)return;let o=r&&e===r.code,l=r?.diffTarget&&!t;if(o&&l){console.log(`🔄 [ImmersiveHistory] Code unchanged, updating current record to clear diffTarget`);return}let u=Date.now()-a.value;if(i.currentIndex<i.records.length-1&&o&&u<1e3){console.log(`🚫 [ImmersiveHistory] Ignoring record: likely navigation sync (${u}ms ago)`);return}i.currentIndex<i.records.length-1&&(console.log(`✂️ [ImmersiveHistory] Truncating future history from index ${i.currentIndex+1}`),i.records=i.records.slice(0,i.currentIndex+1));let d={id:m(),code:e,diffTarget:t,timestamp:Date.now(),isStreamingRecord:n??!1};i.records.push(d),i.currentIndex=i.records.length-1,console.log(`📝 [ImmersiveHistory] Recorded new state`,{id:d.id,hasDiff:!!t,codeSnippet:e.substring(0,30).replace(/\n/g,`\\n`)+`...`})}function g(e,n,r){console.group(`🌟 [ImmersiveHistory] New Major Version`);let a=r||m(),o={id:a,timestamp:Date.now(),label:n||`版本 ${t.value.length+1}`,records:[{id:a,code:e,timestamp:Date.now()}],currentIndex:0};t.value.push(o),i.value=t.value.length-1,console.log(`Created:`,o),console.groupEnd()}function _(e,n,r,a){console.group(`🌟 [ImmersiveHistory] New Major Diff Version`);let o={id:r,timestamp:Date.now(),label:a||`版本 ${t.value.length+1}`,records:[{id:r,code:e,diffTarget:n,timestamp:Date.now()}],currentIndex:0};t.value.push(o),i.value=t.value.length-1,console.log(`Created:`,o),console.groupEnd()}function v(){s.value&&d.value?(console.log(`⬅️ [ImmersiveHistory] Undo`),a.value=Date.now(),s.value.currentIndex--):console.warn(`🚫 [ImmersiveHistory] Cannot Undo`)}function y(){s.value&&p.value?(console.log(`➡️ [ImmersiveHistory] Redo`),a.value=Date.now(),s.value.currentIndex++):console.warn(`🚫 [ImmersiveHistory] Cannot Redo`)}function b(e){e>=0&&e<t.value.length&&(console.log(`🔀 [ImmersiveHistory] Switching to Major Version ${e}`),a.value=Date.now(),i.value=e)}function x(){return{versions:t.value.map(e=>({id:e.id,timestamp:e.timestamp,label:e.label,records:e.records.map(e=>({id:e.id,code:e.code,diffTarget:e.diffTarget,timestamp:e.timestamp,isStreamingRecord:e.isStreamingRecord})),currentIndex:e.currentIndex})),currentVersionIndex:i.value}}function S(e){e.versions&&e.versions.length>0&&(t.value=e.versions.map(e=>({id:e.id,timestamp:e.timestamp,label:e.label,records:e.records&&e.records.length>0?e.records.map(e=>{let t=e.code,n=e.diffTarget;return e.diff&&e.originalCode&&(!e.code||e.code.trim()===``)?(t=e.originalCode,n=e.diff,console.log(`🔄 [ImmersiveHistory] Converting diff record to diff mode`,{recordId:e.id,hasOriginalCode:!!e.originalCode,hasDiff:!!e.diff})):e.diff&&!n&&(n=e.diff),(!t||t.trim()===``)&&(t=e.originalCode||``),{id:e.id,code:t||``,diffTarget:n,timestamp:e.timestamp,originalCode:e.originalCode}}):[{id:m(),code:l.value||``,timestamp:e.timestamp}],currentIndex:e.currentIndex??0})),i.value=Math.max(0,Math.min(e.currentVersionIndex,t.value.length-1)),console.log(`📥 [ImmersiveHistory] History restored`,{versionCount:t.value.length,currentIndex:i.value}))}return{versions:n(t),currentVersionIndex:n(i),currentVersion:s,currentRecord:c,currentCode:l,currentDiffTarget:u,canUndo:d,canRedo:p,record:h,addMajorVersion:g,addMajorDiffVersion:_,undo:v,redo:y,switchVersion:b,getHistory:x,setHistory:S}}function Oe(){let e=e=>{if(!e)return e;let t=e.replace(/^\uFEFF/,``);return t=t.replace(/\r\n/g,`
`).replace(/\r/g,`
`),t=t.split(`
`).map(e=>e.replace(/\s+$/,``)).join(`
`),t},t=t=>{let n=t.split(`
`),r=``,i=``,a=null;for(let e of n)if(/[-]{3,}\s*SEARCH/i.test(e)){a=`search`;continue}else if(/[=]{3,}/.test(e)){a=`replace`;continue}else if(/[+]{3,}\s*REPLACE/i.test(e))break;else a&&(a===`search`?r+=e+`
`:a===`replace`&&(i+=e+`
`));return{search:e(r.trimEnd()),replace:e(i.trimEnd())}},n=e=>{let n=[],r=e.split(/(?=[-]{3,}\s*SEARCH)/);for(let e of r)if(e.trim()){let r=t(e);r.search.trim()&&n.push(r)}return n},r=(e,t,n)=>{let r=e;if(e.includes(t))return r=e.replace(t,n),r;let i=e.split(`
`),a=t.split(`
`),o=n.split(`
`);if(a.length===0)return r;for(let e=0;e<i.length-a.length+1;e++)if(i.slice(e,e+a.length).join(`
`)===a.join(`
`))return i.splice(e,a.length,...o),r=i.join(`
`),r;for(let e=0;e<i.length-a.length+1;e++){let t=i.slice(e,e+a.length),n=!0,s=-1,c=``;for(let e=0;e<a.length;e++){let r=a[e],i=t[e];if(!(r.trimEnd()===``&&i.trimEnd()===``)){if(r.trim()!==i.trim()){n=!1;break}s===-1&&r.trim()!==``&&(s=e,c=i.match(/^(\s*)/)?.[1]||``)}}if(n&&s>=0){let t=o.map((e,t)=>{if(e.trimEnd()===``)return e;let n=a[t].match(/^(\s*)/)?.[1]||``,r=(e.match(/^(\s*)/)?.[1]||``).length-n.length,i=Math.max(0,c.length+r);return` `.repeat(i)+e.trimStart()});return i.splice(e,a.length,...t),r=i.join(`
`),r}}return r};return{applyDiff:(i,a)=>{let o=e(i),s=e(a),c=/[-]{3,}\s*SEARCH[\s\S]*?[+]{3,}\s*REPLACE[\s\S]*?[-]{3,}\s*SEARCH/.test(s)||(s.match(/[-]{3,}\s*SEARCH/g)||[]).length>1,l=o,u=0,d=[];if(c){let e=n(s);if(e.length===0)return{content:i,success:!1,appliedCount:0,failedBlocks:[],message:`No valid diff blocks found.`};for(let t of e){let e=l;l=r(l,t.search,t.replace),l===e?d.push(t):u++}return{content:l,success:u>0,appliedCount:u,failedBlocks:d,message:u>0?`成功应用 ${u}/${e.length} 处更改。`:`应用更改失败。`}}else{let{search:e,replace:n}=t(s);return e.trim()?(l=r(l,e,n),l===o?{content:i,success:!1,appliedCount:0,failedBlocks:[{search:e,replace:n}],message:`未找到要替换的内容。`}:{content:l,success:!0,appliedCount:1,failedBlocks:[],message:`成功应用更改。`}):{content:i,success:!1,appliedCount:0,failedBlocks:[],message:`搜索内容为空。`}}}}}var ke=`(function () {\r
  const originalConsole = {\r
    log: console.log,\r
    warn: console.warn,\r
    error: console.error,\r
    info: console.info\r
  };\r
\r
  function sendLog(method, args) {\r
    try {\r
      // Check if any argument is an Error object with stack\r
      let errorStack = null;\r
      const hasError = args.some(arg => arg instanceof Error && arg.stack);\r
      if (hasError) {\r
        // Find the first Error object with stack\r
        const errorArg = args.find(arg => arg instanceof Error && arg.stack);\r
        if (errorArg && errorArg.stack) {\r
          errorStack = errorArg.stack;\r
        }\r
      }\r
\r
      // Capture caller information from current stack\r
      const stack = new Error().stack;\r
      let caller = 'unknown';\r
      let stackTrace = '';\r
\r
      if (stack) {\r
        const stackLines = stack.split('\\n');\r
        // Find the caller (usually the 3rd line, skip Error and sendLog)\r
        if (stackLines.length > 2) {\r
          const callerLine = stackLines[2] || stackLines[1];\r
          if (callerLine) {\r
            // Extract function/file info from stack line\r
            const match = callerLine.match(/at\\s+(.+?)\\s+\\((.+?):(\\d+):(\\d+)\\)/) ||\r
              callerLine.match(/at\\s+(.+?)\\s+(.+?):(\\d+):(\\d+)/) ||\r
              callerLine.match(/at\\s+(.+)/);\r
            if (match) {\r
              caller = (match[1] || match[0]).trim();\r
            }\r
          }\r
          // Get full stack trace (skip first line: Error, keep sendLog for context)\r
          // Include all lines after Error for complete stack trace\r
          stackTrace = stackLines.slice(1).join('\\n');\r
        } else if (stackLines.length > 1) {\r
          // If only 2 lines, still include them\r
          stackTrace = stackLines.slice(1).join('\\n');\r
        }\r
      }\r
\r
      // If we have an Error stack, use it instead (it's more complete)\r
      if (errorStack) {\r
        stackTrace = errorStack;\r
        // Extract caller from error stack if possible\r
        const errorStackLines = errorStack.split('\\n');\r
        if (errorStackLines.length > 1) {\r
          const errorCallerLine = errorStackLines[1];\r
          const match = errorCallerLine.match(/at\\s+(.+?)\\s+\\((.+?):(\\d+):(\\d+)\\)/) ||\r
            errorCallerLine.match(/at\\s+(.+?)\\s+(.+?):(\\d+):(\\d+)/) ||\r
            errorCallerLine.match(/at\\s+(.+)/);\r
          if (match) {\r
            caller = (match[1] || match[0]).trim();\r
          }\r
        }\r
      }\r
\r
      // Simple serialization to pass across iframe boundary\r
      const serializedArgs = args.map(arg => {\r
        if (typeof arg === 'undefined') return 'undefined';\r
        if (arg === null) return 'null';\r
        if (typeof arg === 'function') return arg.toString();\r
        if (arg instanceof Error) {\r
          return {\r
            message: arg.message,\r
            stack: arg.stack || ''\r
          };\r
        }\r
        try {\r
          return JSON.parse(JSON.stringify(arg));\r
        } catch {\r
          return String(arg);\r
        }\r
      });\r
\r
      window.parent.postMessage({\r
        type: 'console-log',\r
        method,\r
        args: serializedArgs,\r
        caller: caller,\r
        stack: stackTrace\r
      }, '*');\r
    } catch (err) {\r
      console.error('Failed to send log to parent', err);\r
    }\r
  }\r
\r
  console.log = (...args) => { originalConsole.log(...args); sendLog('log', args); };\r
  console.warn = (...args) => { originalConsole.warn(...args); sendLog('warn', args); };\r
  console.error = (...args) => { originalConsole.error(...args); sendLog('error', args); };\r
  console.info = (...args) => { originalConsole.info(...args); sendLog('info', args); };\r
\r
  // Capture uncaught errors with full stack trace\r
  window.addEventListener('error', (event) => {\r
    let error = event.error;\r
\r
    // If event.error exists, use it (contains full stack trace)\r
    if (error instanceof Error) {\r
      sendLog('error', [error]);\r
    } else {\r
      // If no error object, create one with available information\r
      const errorMessage = event.message || 'Unknown error';\r
      const errorObj = new Error(errorMessage);\r
\r
      // Try to construct stack trace from event properties\r
      if (event.filename && event.lineno !== undefined) {\r
        errorObj.stack = \`Error: \${errorMessage}\\n    at \${event.filename}:\${event.lineno}:\${event.colno || 0}\`;\r
      } else if (errorMessage) {\r
        errorObj.stack = \`Error: \${errorMessage}\`;\r
      }\r
\r
      sendLog('error', [errorObj]);\r
    }\r
  });\r
\r
  // Capture unhandled promise rejections\r
  window.addEventListener('unhandledrejection', (event) => {\r
    let error = event.reason;\r
\r
    // If reason is an Error object, use it directly\r
    if (error instanceof Error) {\r
      sendLog('error', [error]);\r
    } else {\r
      // Otherwise, create an Error object from the reason\r
      const errorMessage = error ? String(error) : 'Unhandled Promise Rejection';\r
      const errorObj = new Error(errorMessage);\r
\r
      // Try to preserve original error information\r
      if (error && typeof error === 'object') {\r
        try {\r
          errorObj.stack = \`Error: \${errorMessage}\\n    at Promise (unhandled rejection)\`;\r
        } catch {\r
          // Ignore\r
        }\r
      }\r
\r
      sendLog('error', [errorObj]);\r
    }\r
  });\r
})();`,K=`(function () {\r
  let isSelectorActive = false;\r
  let currentHighlight = null;\r
  let highlightOverlay = null;\r
  let selectorLabel = null;\r
\r
  function createHighlightOverlay() {\r
    if (highlightOverlay) return highlightOverlay;\r
\r
    highlightOverlay = document.createElement("div");\r
    highlightOverlay.style.cssText =\r
      "position: absolute; pointer-events: none; z-index: 999999; " +\r
      "border: 2px solid #2563EB; background: rgba(37, 99, 235, 0.2); " +\r
      "box-sizing: border-box; display: none; " +\r
      "transition: left 0.15s ease-out, top 0.15s ease-out, width 0.15s ease-out, height 0.15s ease-out, opacity 0.15s ease-out; " +\r
      "opacity: 0;";\r
    document.body.appendChild(highlightOverlay);\r
    return highlightOverlay;\r
  }\r
\r
  function createSelectorLabel() {\r
    if (selectorLabel) return selectorLabel;\r
\r
    selectorLabel = document.createElement("div");\r
    selectorLabel.style.cssText =\r
      "position: absolute; z-index: 1000000; " +\r
      "background: #2563EB; color: white; " +\r
      "padding: 4px 8px; font-size: 11px; " +\r
      "font-family: 'SF Mono', 'Monaco', 'Inconsolata', 'Fira Code', 'Droid Sans Mono', 'Source Code Pro', 'Consolas', 'Courier New', monospace; " +\r
      "font-weight: 400; letter-spacing: 0; " +\r
      "border-radius: 2px; white-space: nowrap; " +\r
      "pointer-events: auto; cursor: pointer; " +\r
      "box-shadow: 0 2px 4px rgba(0,0,0,0.2); " +\r
      "max-width: 300px; overflow: hidden; text-overflow: ellipsis; " +\r
      "transition: left 0.15s ease-out, top 0.15s ease-out, transform 0.15s ease-out; " +\r
      "display: none;";\r
    document.body.appendChild(selectorLabel);\r
\r
    // Add click handler\r
    selectorLabel.addEventListener("click", function (e) {\r
      e.stopPropagation();\r
      if (currentHighlight) {\r
        const elementData = getElementData(currentHighlight);\r
        window.parent.postMessage(\r
          {\r
            type: "element-selected",\r
            selector: elementData ? elementData.selector : "",\r
            data: elementData,\r
          },\r
          "*"\r
        );\r
        // Disable selector after element is selected\r
        disableSelector();\r
        // Notify parent that selector is disabled\r
        window.parent.postMessage(\r
          {\r
            type: "toggle-element-selector",\r
            enabled: false,\r
          },\r
          "*"\r
        );\r
      }\r
    });\r
\r
    return selectorLabel;\r
  }\r
\r
  // Escape CSS selector special characters\r
  function escapeSelector(str) {\r
    if (!str) return "";\r
    return str.replace(/([!"#$%&'()*+,.:;<=>?@[\\\\\\]^\`{|}~])/g, "\\\\$1");\r
  }\r
\r
  // Get nth-child index of element among siblings of same tag\r
  function getNthChildIndex(element) {\r
    const parent = element.parentElement;\r
    if (!parent) return 1;\r
\r
    const tag = element.tagName.toLowerCase();\r
    let index = 1;\r
    for (let sibling = element.previousElementSibling; sibling; sibling = sibling.previousElementSibling) {\r
      if (sibling.tagName.toLowerCase() === tag) {\r
        index++;\r
      }\r
    }\r
    return index;\r
  }\r
\r
  // Generate a unique selector for an element\r
  function getElementSelector(element) {\r
    if (!element || element === document.body || element === document.documentElement) {\r
      return "";\r
    }\r
\r
    // If element has a unique ID, use it (fastest and most reliable)\r
    if (element.id) {\r
      const idSelector = "#" + escapeSelector(element.id);\r
      try {\r
        const matches = document.querySelectorAll(idSelector);\r
        if (matches.length === 1 && matches[0] === element) {\r
          return idSelector;\r
        }\r
      } catch {\r
        // Invalid selector, continue with other methods\r
      }\r
    }\r
\r
    // Build path from element to root\r
    const path = [];\r
    let current = element;\r
\r
    while (current && current !== document.body && current !== document.documentElement) {\r
      let selector = current.tagName.toLowerCase();\r
\r
      // Add ID if available\r
      if (current.id) {\r
        selector += "#" + escapeSelector(current.id);\r
        path.unshift(selector);\r
        // If we have an ID, we can stop here (assuming IDs are unique)\r
        // But verify it's unique first\r
        try {\r
          const idSelector = "#" + escapeSelector(current.id);\r
          const matches = document.querySelectorAll(idSelector);\r
          if (matches.length === 1) {\r
            break;\r
          }\r
        } catch {\r
          // Continue building path\r
        }\r
      } else {\r
        // Add classes if available\r
        if (current.className && typeof current.className === "string") {\r
          const classes = current.className\r
            .split(" ")\r
            .filter((c) => c && c.trim())\r
            .map((c) => "." + escapeSelector(c))\r
            .join("");\r
          if (classes) {\r
            selector += classes;\r
          }\r
        }\r
\r
        // Add nth-child for uniqueness\r
        const nth = getNthChildIndex(current);\r
        selector += ":nth-of-type(" + nth + ")";\r
\r
        path.unshift(selector);\r
      }\r
\r
      current = current.parentElement;\r
    }\r
\r
    // Join path segments\r
    const fullSelector = path.join(" > ");\r
\r
    // Verify the selector is unique\r
    try {\r
      const matches = document.querySelectorAll(fullSelector);\r
      if (matches.length === 1 && matches[0] === element) {\r
        return fullSelector;\r
      }\r
    } catch {\r
      // Selector might be invalid, try simpler approach\r
    }\r
\r
    // Fallback: try with just tag and nth-child\r
    const simplePath = [];\r
    current = element;\r
    while (current && current !== document.body && current !== document.documentElement) {\r
      const tag = current.tagName.toLowerCase();\r
      const nth = getNthChildIndex(current);\r
      simplePath.unshift(tag + ":nth-of-type(" + nth + ")");\r
      current = current.parentElement;\r
    }\r
\r
    const simpleSelector = simplePath.join(" > ");\r
    try {\r
      const matches = document.querySelectorAll(simpleSelector);\r
      if (matches.length === 1 && matches[0] === element) {\r
        return simpleSelector;\r
      }\r
    } catch {\r
      // Last resort fallback\r
    }\r
\r
    // Last resort: return the original simple selector\r
    return fullSelector || simpleSelector;\r
  }\r
\r
  function getElementData(element) {\r
    if (!element || element === document.body || element === document.documentElement) {\r
      return null;\r
    }\r
\r
    const rect = element.getBoundingClientRect();\r
    const styles = window.getComputedStyle(element);\r
\r
    return {\r
      selector: getElementSelector(element),\r
      tagName: element.tagName.toLowerCase(),\r
      id: element.id || null,\r
      className: element.className || null,\r
      classList: element.className ? element.className.split(" ").filter((c) => c) : [],\r
      textContent: element.textContent\r
        ? element.textContent.trim().substring(0, 100)\r
        : null,\r
      innerHTML: element.innerHTML ? element.innerHTML.substring(0, 200) : null,\r
      attributes: Array.from(element.attributes).reduce((acc, attr) => {\r
        acc[attr.name] = attr.value;\r
        return acc;\r
      }, {}),\r
      position: {\r
        x: rect.x,\r
        y: rect.y,\r
        width: rect.width,\r
        height: rect.height,\r
        top: rect.top,\r
        left: rect.left,\r
        right: rect.right,\r
        bottom: rect.bottom,\r
      },\r
      styles: {\r
        display: styles.display,\r
        position: styles.position,\r
        visibility: styles.visibility,\r
        opacity: styles.opacity,\r
        zIndex: styles.zIndex,\r
        color: styles.color,\r
        backgroundColor: styles.backgroundColor,\r
        fontSize: styles.fontSize,\r
        fontFamily: styles.fontFamily,\r
      },\r
    };\r
  }\r
\r
  function updateSelectorLabel(element, rect) {\r
    const label = createSelectorLabel();\r
    if (!element || element === document.body || element === document.documentElement) {\r
      label.style.display = "none";\r
      return;\r
    }\r
\r
    // Display only tagName instead of selector\r
    const tagName = element.tagName.toLowerCase();\r
    // Only update text if it changed to avoid unnecessary reflows\r
    if (label.textContent !== tagName) {\r
      label.textContent = tagName;\r
    }\r
\r
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;\r
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;\r
\r
    // Ensure label is visible for measurement\r
    if (label.style.display === "none") {\r
      label.style.display = "block";\r
      label.style.visibility = "hidden";\r
    }\r
\r
    // Measure label dimensions\r
    const labelHeight = label.offsetHeight || label.scrollHeight;\r
    const labelWidth = label.offsetWidth || label.scrollWidth;\r
    label.style.visibility = "visible";\r
\r
    // Check if there's enough space at the top (at least label height + some padding)\r
    const minTopSpace = labelHeight + 4;\r
    const topSpace = rect.top + scrollY;\r
    const canShowOnTop = topSpace >= minTopSpace;\r
\r
    // Calculate position - align label left edge with element left edge\r
    let labelLeft = rect.left + scrollX;\r
    let labelTop = rect.top + scrollY;\r
\r
    if (canShowOnTop) {\r
      // Show above the element\r
      labelTop = rect.top + scrollY;\r
      label.style.transform = "translateY(-100%)";\r
      label.style.marginTop = "0px";\r
    } else {\r
      // Show inside the element at the top\r
      labelTop = rect.top + scrollY;\r
      label.style.transform = "none";\r
      label.style.marginTop = "0px";\r
    }\r
\r
    // Ensure label doesn't overflow horizontally\r
    const maxLeft = rect.left + scrollX + rect.width - labelWidth;\r
    if (labelLeft > maxLeft) {\r
      labelLeft = Math.max(rect.left + scrollX, maxLeft);\r
    }\r
\r
    // Update position with smooth transition\r
    label.style.left = labelLeft + "px";\r
    label.style.top = labelTop + "px";\r
    label.style.display = "block";\r
  }\r
\r
  function highlightElement(element) {\r
    if (!isSelectorActive) return;\r
\r
    const overlay = createHighlightOverlay();\r
\r
    if (!element || element === document.body || element === document.documentElement) {\r
      overlay.style.opacity = "0";\r
      overlay.style.display = "none";\r
      updateSelectorLabel(null, null);\r
      return;\r
    }\r
\r
    const rect = element.getBoundingClientRect();\r
    const scrollX = window.pageXOffset || document.documentElement.scrollLeft;\r
    const scrollY = window.pageYOffset || document.documentElement.scrollTop;\r
\r
    // Calculate exact position to match element (overlay floats above the element)\r
    const left = rect.left + scrollX;\r
    const top = rect.top + scrollY;\r
    const width = rect.width;\r
    const height = rect.height;\r
\r
    // Set position and size with smooth transition\r
    overlay.style.left = left + "px";\r
    overlay.style.top = top + "px";\r
    overlay.style.width = width + "px";\r
    overlay.style.height = height + "px";\r
\r
    // Show overlay with fade-in animation\r
    if (overlay.style.display === "none") {\r
      overlay.style.display = "block";\r
      // Trigger reflow to ensure transition works\r
      void overlay.offsetHeight;\r
    }\r
    overlay.style.opacity = "1";\r
\r
    updateSelectorLabel(element, rect);\r
    currentHighlight = element;\r
  }\r
\r
  function handleMouseMove(e) {\r
    if (!isSelectorActive) return;\r
\r
    // Get all elements at the point (using elementsFromPoint to get all layers)\r
    const elements = document.elementsFromPoint(e.clientX, e.clientY);\r
    if (!elements || elements.length === 0) return;\r
\r
    // Find the first element that is not our overlay or label\r
    let targetElement = null;\r
    for (let i = 0; i < elements.length; i++) {\r
      const el = elements[i];\r
      // Skip our overlay and label elements\r
      if (el === highlightOverlay || el === selectorLabel) {\r
        continue;\r
      }\r
      // Skip if element is a child of overlay or label\r
      if (highlightOverlay && highlightOverlay.contains(el)) {\r
        continue;\r
      }\r
      if (selectorLabel && selectorLabel.contains(el)) {\r
        continue;\r
      }\r
      // Skip body and html\r
      if (el === document.body || el === document.documentElement) {\r
        continue;\r
      }\r
      targetElement = el;\r
      break;\r
    }\r
\r
    if (targetElement && targetElement !== currentHighlight) {\r
      highlightElement(targetElement);\r
    }\r
  }\r
\r
  function handleMouseLeave() {\r
    if (!isSelectorActive) return;\r
    const overlay = createHighlightOverlay();\r
    overlay.style.opacity = "0";\r
    // Hide after transition completes\r
    setTimeout(() => {\r
      if (overlay.style.opacity === "0") {\r
        overlay.style.display = "none";\r
      }\r
    }, 150);\r
    updateSelectorLabel(null, null);\r
    currentHighlight = null;\r
  }\r
\r
  function handleClick(e) {\r
    if (!isSelectorActive) return;\r
\r
    // Don't handle clicks on the label (it has its own handler)\r
    if (selectorLabel && selectorLabel.contains(e.target)) {\r
      return;\r
    }\r
\r
    // Don't handle clicks on the overlay\r
    if (highlightOverlay && highlightOverlay.contains(e.target)) {\r
      return;\r
    }\r
\r
    // Get the element that was clicked\r
    const elements = document.elementsFromPoint(e.clientX, e.clientY);\r
    if (!elements || elements.length === 0) return;\r
\r
    // Find the first element that is not our overlay or label\r
    let targetElement = null;\r
    for (let i = 0; i < elements.length; i++) {\r
      const el = elements[i];\r
      if (el === highlightOverlay || el === selectorLabel) {\r
        continue;\r
      }\r
      if (highlightOverlay && highlightOverlay.contains(el)) {\r
        continue;\r
      }\r
      if (selectorLabel && selectorLabel.contains(el)) {\r
        continue;\r
      }\r
      if (el === document.body || el === document.documentElement) {\r
        continue;\r
      }\r
      targetElement = el;\r
      break;\r
    }\r
\r
    if (targetElement) {\r
      e.preventDefault();\r
      e.stopPropagation();\r
      const elementData = getElementData(targetElement);\r
      window.parent.postMessage(\r
        {\r
          type: "element-selected",\r
          selector: elementData ? elementData.selector : "",\r
          data: elementData,\r
        },\r
        "*"\r
      );\r
      // Disable selector after element is selected\r
      disableSelector();\r
      // Notify parent that selector is disabled\r
      window.parent.postMessage(\r
        {\r
          type: "toggle-element-selector",\r
          enabled: false,\r
        },\r
        "*"\r
      );\r
    }\r
  }\r
\r
  function enableSelector() {\r
    isSelectorActive = true;\r
    document.addEventListener("mousemove", handleMouseMove);\r
    document.addEventListener("mouseleave", handleMouseLeave);\r
    document.addEventListener("click", handleClick, true); // Use capture phase\r
    createHighlightOverlay();\r
    createSelectorLabel();\r
    // Focus the window when selector is enabled\r
    window.focus();\r
  }\r
\r
  function disableSelector() {\r
    isSelectorActive = false;\r
    document.removeEventListener("mousemove", handleMouseMove);\r
    document.removeEventListener("mouseleave", handleMouseLeave);\r
    document.removeEventListener("click", handleClick, true);\r
\r
    if (highlightOverlay) {\r
      highlightOverlay.style.opacity = "0";\r
      // Hide after transition completes\r
      setTimeout(() => {\r
        if (highlightOverlay && highlightOverlay.style.opacity === "0") {\r
          highlightOverlay.style.display = "none";\r
        }\r
      }, 150);\r
    }\r
    if (selectorLabel) {\r
      selectorLabel.style.display = "none";\r
    }\r
    currentHighlight = null;\r
  }\r
\r
  // Select element by selector and highlight it (without enabling selector mode)\r
  function selectElementBySelector(selector) {\r
    if (!selector) return;\r
\r
    try {\r
      // Try to find element by selector\r
      let element = null;\r
\r
      // Try querySelector first\r
      try {\r
        element = document.querySelector(selector);\r
      } catch (e) {\r
        console.warn("Failed to query selector:", selector, e);\r
      }\r
\r
      // If not found, try to parse and find manually\r
      if (!element && selector) {\r
        // Parse selector: tag#id.class1.class2\r
        const parts = selector.match(/^([a-z]+)?(#[a-zA-Z0-9_-]+)?(\\.[a-zA-Z0-9_-]+)*$/);\r
        if (parts) {\r
          const tag = parts[1] || "*";\r
          const id = parts[2] ? parts[2].substring(1) : null;\r
          const classes = parts[3] ? parts[3].split(".").filter((c) => c) : [];\r
\r
          // Try to find by tag, id, and classes\r
          const candidates = document.querySelectorAll(tag);\r
          for (let i = 0; i < candidates.length; i++) {\r
            const el = candidates[i];\r
            let matches = true;\r
\r
            if (id && el.id !== id) {\r
              matches = false;\r
            }\r
\r
            if (matches && classes.length > 0) {\r
              const elClasses = el.className\r
                ? el.className.split(" ").filter((c) => c)\r
                : [];\r
              for (let j = 0; j < classes.length; j++) {\r
                if (!elClasses.includes(classes[j])) {\r
                  matches = false;\r
                  break;\r
                }\r
              }\r
            }\r
\r
            if (matches) {\r
              element = el;\r
              break;\r
            }\r
          }\r
        }\r
      }\r
\r
      if (element && element !== document.body && element !== document.documentElement) {\r
        // Highlight the element (similar to highlightElement but persistent)\r
        const overlay = createHighlightOverlay();\r
        const rect = element.getBoundingClientRect();\r
        const scrollX = window.pageXOffset || document.documentElement.scrollLeft;\r
        const scrollY = window.pageYOffset || document.documentElement.scrollTop;\r
\r
        const left = rect.left + scrollX;\r
        const top = rect.top + scrollY;\r
        const width = rect.width;\r
        const height = rect.height;\r
\r
        overlay.style.left = left + "px";\r
        overlay.style.top = top + "px";\r
        overlay.style.width = width + "px";\r
        overlay.style.height = height + "px";\r
\r
        if (overlay.style.display === "none") {\r
          overlay.style.display = "block";\r
          void overlay.offsetHeight; // Trigger reflow\r
        }\r
        overlay.style.opacity = "1";\r
\r
        updateSelectorLabel(element, rect);\r
        currentHighlight = element;\r
\r
        // Scroll element into view\r
        element.scrollIntoView({ behavior: "smooth", block: "center" });\r
\r
        // Add click handler to remove highlight when clicking outside\r
        function handleClickOutside(e) {\r
          // Check if click is outside the highlighted element\r
          const target = e.target;\r
          const isClickOnHighlight =\r
            currentHighlight &&\r
            (currentHighlight === target || currentHighlight.contains(target));\r
          const isClickOnOverlay =\r
            highlightOverlay &&\r
            (highlightOverlay === target || highlightOverlay.contains(target));\r
          const isClickOnLabel =\r
            selectorLabel && (selectorLabel === target || selectorLabel.contains(target));\r
\r
          if (!isClickOnHighlight && !isClickOnOverlay && !isClickOnLabel) {\r
            // Remove highlight with fade-out animation\r
            if (highlightOverlay) {\r
              highlightOverlay.style.opacity = "0";\r
              setTimeout(() => {\r
                if (highlightOverlay && highlightOverlay.style.opacity === "0") {\r
                  highlightOverlay.style.display = "none";\r
                }\r
              }, 150);\r
            }\r
            if (selectorLabel) {\r
              selectorLabel.style.display = "none";\r
            }\r
            currentHighlight = null;\r
            // Remove this listener\r
            document.removeEventListener("click", handleClickOutside, true);\r
          }\r
        }\r
\r
        // Add click listener to detect clicks outside (use capture phase to catch early)\r
        setTimeout(() => {\r
          document.addEventListener("click", handleClickOutside, true);\r
        }, 100);\r
      }\r
    } catch (e) {\r
      console.error("Error selecting element by selector:", e);\r
    }\r
  }\r
\r
  // Listen for selector toggle messages\r
  window.addEventListener("message", function (event) {\r
    if (event.data && event.data.type === "toggle-element-selector") {\r
      if (event.data.enabled) {\r
        enableSelector();\r
      } else {\r
        disableSelector();\r
      }\r
    } else if (event.data && event.data.type === "focus-iframe") {\r
      // Focus the iframe window when requested\r
      window.focus();\r
    } else if (event.data && event.data.type === "select-element-by-selector") {\r
      // Select and highlight element by selector\r
      selectElementBySelector(event.data.selector);\r
    }\r
  });\r
\r
  // Expose for direct access\r
  window.__elementSelector = {\r
    enable: enableSelector,\r
    disable: disableSelector,\r
    get isActive() {\r
      return isSelectorActive;\r
    },\r
  };\r
})();\r
`,q=`(function () {\r
  function handleKeyDown(event) {\r
    // ESC: Exit element selector mode if active\r
    if (event.key === "Escape" || event.keyCode === 27) {\r
      // Check if element selector is active\r
      const selector = window.__elementSelector;\r
      if (selector && selector.isActive) {\r
        // Disable selector\r
        if (selector.disable) {\r
          selector.disable();\r
        }\r
        // Notify parent to update state\r
        window.parent.postMessage(\r
          {\r
            type: "toggle-element-selector",\r
            enabled: false,\r
          },\r
          "*"\r
        );\r
        event.preventDefault();\r
        event.stopPropagation();\r
      }\r
    }\r
\r
    // Ctrl+\` or Cmd+\`: Toggle console\r
    if (\r
      (event.ctrlKey || event.metaKey) &&\r
      (event.key === "\`" || event.keyCode === 192)\r
    ) {\r
      window.parent.postMessage(\r
        {\r
          type: "toggle-console",\r
        },\r
        "*"\r
      );\r
      event.preventDefault();\r
      event.stopPropagation();\r
    }\r
  }\r
\r
  // Add keyboard event listener\r
  // Use capture phase to catch events early\r
  document.addEventListener("keydown", handleKeyDown, true);\r
})();\r
`,J={class:`w-full h-full bg-white relative`},Y=[`srcdoc`],Ae=b({__name:`PreviewFrame`,props:{code:{},enableElementSelector:{type:Boolean}},emits:[`console-log`,`element-selected`,`toggle-console`,`toggle-element-selector`,`load-complete`,`load-error`],setup(e,{expose:t,emit:n}){let i=e,a=n,s=f(),c=f(null),l=f(!1),u=`<script>`+ke+`<\/script>`,d=`<script>`+K+`<\/script>`,p=`<script>`+q+`<\/script>`,m=o(()=>{let e=(u.match(/\n/g)||[]).length,t=(d.match(/\n/g)||[]).length,n=(p.match(/\n/g)||[]).length;return e+t+n}),g=o(()=>u+d+p+i.code);r(()=>i.code,()=>{l.value=!1,b()},{immediate:!1});function _(e){let t=e.data;t&&t.type===`console-log`?a(`console-log`,{method:t.method,args:t.args,caller:t.caller,stack:t.stack,lineOffset:m.value}):t&&t.type===`element-selected`?a(`element-selected`,t.selector,t.data):t&&t.type===`toggle-console`?a(`toggle-console`):t&&t.type===`toggle-element-selector`&&a(`toggle-element-selector`,t.enabled||!1)}function v(){c.value&&=(clearTimeout(c.value),null)}function b(){v(),l.value=!1,c.value=setTimeout(()=>{l.value||(l.value=!0,a(`load-error`))},1e4)}function S(){}function C(e){s.value?.contentWindow&&s.value.contentWindow.postMessage({type:`toggle-element-selector`,enabled:e},`*`)}function T(e){s.value?.contentWindow&&s.value.contentWindow.postMessage({type:`select-element-by-selector`,selector:e},`*`)}r(()=>i.enableElementSelector,e=>{w(()=>{s.value?.contentWindow&&(C(e||!1),e&&(s.value?.focus(),s.value.contentWindow.postMessage({type:`focus-iframe`},`*`)))})},{immediate:!0});function ee(){v(),l.value||(l.value=!0,a(`load-error`))}function E(){v(),l.value||(l.value=!0,a(`load-complete`)),i.enableElementSelector&&s.value?.contentWindow&&C(!0)}function te(){if(!s.value)return!1;try{return(s.value.contentDocument||s.value.contentWindow?.document)?.readyState===`complete`||l.value}catch{return l.value}}return t({refresh:S,selectElementBySelector:T,checkIfLoaded:te,getIframe:()=>s.value}),typeof window<`u`&&window.addEventListener(`message`,_),r(()=>i.code,()=>{l.value=!1,b()},{immediate:!0}),y(()=>{v()}),(e,t)=>(x(),h(`div`,J,[D(`iframe`,{ref_key:`iframeRef`,ref:s,srcdoc:g.value,class:`w-full h-full border-none`,allow:`xr-spatial-tracking; web-share`,sandbox:`allow-pointer-lock allow-popups allow-forms allow-popups-to-escape-sandbox allow-downloads allow-scripts allow-same-origin`,onLoad:E,onError:ee},null,40,Y)]))}}),[X,je]=P(`DialogRoot`),Me=b({inheritAttrs:!1,__name:`DialogRoot`,props:{open:{type:Boolean,required:!1,default:void 0},defaultOpen:{type:Boolean,required:!1,default:!1},modal:{type:Boolean,required:!1,default:!0}},emits:[`update:open`],setup(e,{emit:t}){let n=e,r=U(n,`open`,t,{defaultValue:n.defaultOpen,passive:n.open===void 0}),a=f(),o=f(),{modal:s}=i(n);return je({open:r,modal:s,openModal:()=>{r.value=!0},onOpenChange:e=>{r.value=e},onOpenToggle:()=>{r.value=!r.value},contentId:``,titleId:``,descriptionId:``,triggerElement:a,contentElement:o}),(e,t)=>k(e.$slots,`default`,{open:E(r),close:()=>r.value=!1})}}),Ne=b({__name:`DialogClose`,props:{asChild:{type:Boolean,required:!1},as:{type:null,required:!1,default:`button`}},setup(e){let n=e;I();let r=X();return(e,i)=>(x(),a(E(R),v(n,{type:e.as===`button`?`button`:void 0,onClick:i[0]||=e=>E(r).onOpenChange(!1)}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16,[`type`]))}}),Pe=b({__name:`DialogContentImpl`,props:{forceMount:{type:Boolean,required:!1},trapFocus:{type:Boolean,required:!1},disableOutsidePointerEvents:{type:Boolean,required:!1},asChild:{type:Boolean,required:!1},as:{type:null,required:!1}},emits:[`escapeKeyDown`,`pointerDownOutside`,`focusOutside`,`interactOutside`,`openAutoFocus`,`closeAutoFocus`],setup(n,{emit:r}){let i=n,o=r,s=X(),{forwardRef:c,currentElement:l}=I();return s.titleId||=F(void 0,`reka-dialog-title`),s.descriptionId||=F(void 0,`reka-dialog-description`),ee(()=>{s.contentElement=l,ne()!==document.body&&(s.triggerElement.value=ne())}),(n,r)=>(x(),a(E(M),{"as-child":``,loop:``,trapped:i.trapFocus,onMountAutoFocus:r[5]||=e=>o(`openAutoFocus`,e),onUnmountAutoFocus:r[6]||=e=>o(`closeAutoFocus`,e)},{default:t(()=>[e(E(ae),v({id:E(s).contentId,ref:E(c),as:n.as,"as-child":n.asChild,"disable-outside-pointer-events":n.disableOutsidePointerEvents,role:`dialog`,"aria-describedby":E(s).descriptionId,"aria-labelledby":E(s).titleId,"data-state":E(se)(E(s).open.value)},n.$attrs,{onDismiss:r[0]||=e=>E(s).onOpenChange(!1),onEscapeKeyDown:r[1]||=e=>o(`escapeKeyDown`,e),onFocusOutside:r[2]||=e=>o(`focusOutside`,e),onInteractOutside:r[3]||=e=>o(`interactOutside`,e),onPointerDownOutside:r[4]||=e=>o(`pointerDownOutside`,e)}),{default:t(()=>[k(n.$slots,`default`)]),_:3},16,[`id`,`as`,`as-child`,`disable-outside-pointer-events`,`aria-describedby`,`aria-labelledby`,`data-state`])]),_:3},8,[`trapped`]))}}),Fe=b({__name:`DialogContentModal`,props:{forceMount:{type:Boolean,required:!1},trapFocus:{type:Boolean,required:!1},disableOutsidePointerEvents:{type:Boolean,required:!1},asChild:{type:Boolean,required:!1},as:{type:null,required:!1}},emits:[`escapeKeyDown`,`pointerDownOutside`,`focusOutside`,`interactOutside`,`openAutoFocus`,`closeAutoFocus`],setup(e,{emit:n}){let r=e,i=n,o=X(),s=L(i),{forwardRef:c,currentElement:l}=I();return re(l),(e,n)=>(x(),a(Pe,v({...r,...E(s)},{ref:E(c),"trap-focus":E(o).open.value,"disable-outside-pointer-events":!0,onCloseAutoFocus:n[0]||=e=>{e.defaultPrevented||(e.preventDefault(),E(o).triggerElement.value?.focus())},onPointerDownOutside:n[1]||=e=>{let t=e.detail.originalEvent,n=t.button===0&&t.ctrlKey===!0;(t.button===2||n)&&e.preventDefault()},onFocusOutside:n[2]||=e=>{e.preventDefault()}}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16,[`trap-focus`]))}}),Ie=b({__name:`DialogContentNonModal`,props:{forceMount:{type:Boolean,required:!1},trapFocus:{type:Boolean,required:!1},disableOutsidePointerEvents:{type:Boolean,required:!1},asChild:{type:Boolean,required:!1},as:{type:null,required:!1}},emits:[`escapeKeyDown`,`pointerDownOutside`,`focusOutside`,`interactOutside`,`openAutoFocus`,`closeAutoFocus`],setup(e,{emit:n}){let r=e,i=L(n);I();let o=X(),s=f(!1),c=f(!1);return(e,n)=>(x(),a(Pe,v({...r,...E(i)},{"trap-focus":!1,"disable-outside-pointer-events":!1,onCloseAutoFocus:n[0]||=e=>{e.defaultPrevented||(s.value||E(o).triggerElement.value?.focus(),e.preventDefault()),s.value=!1,c.value=!1},onInteractOutside:n[1]||=e=>{e.defaultPrevented||(s.value=!0,e.detail.originalEvent.type===`pointerdown`&&(c.value=!0));let t=e.target;E(o).triggerElement.value?.contains(t)&&e.preventDefault(),e.detail.originalEvent.type===`focusin`&&c.value&&e.preventDefault()}}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16))}}),Le=b({__name:`DialogContent`,props:{forceMount:{type:Boolean,required:!1},disableOutsidePointerEvents:{type:Boolean,required:!1},asChild:{type:Boolean,required:!1},as:{type:null,required:!1}},emits:[`escapeKeyDown`,`pointerDownOutside`,`focusOutside`,`interactOutside`,`openAutoFocus`,`closeAutoFocus`],setup(e,{emit:n}){let r=e,i=n,o=X(),s=L(i),{forwardRef:c}=I();return(e,n)=>(x(),a(E(B),{present:e.forceMount||E(o).open.value},{default:t(()=>[E(o).modal.value?(x(),a(Fe,v({key:0,ref:E(c)},{...r,...E(s),...e.$attrs}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16)):(x(),a(Ie,v({key:1,ref:E(c)},{...r,...E(s),...e.$attrs}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16))]),_:3},8,[`present`]))}}),Re=b({__name:`DialogOverlayImpl`,props:{asChild:{type:Boolean,required:!1},as:{type:null,required:!1}},setup(e){let n=X();return ue(!0),I(),(e,r)=>(x(),a(E(R),{as:e.as,"as-child":e.asChild,"data-state":E(n).open.value?`open`:`closed`,style:{"pointer-events":`auto`}},{default:t(()=>[k(e.$slots,`default`)]),_:3},8,[`as`,`as-child`,`data-state`]))}}),ze=b({__name:`DialogOverlay`,props:{forceMount:{type:Boolean,required:!1},asChild:{type:Boolean,required:!1},as:{type:null,required:!1}},setup(n){let r=X(),{forwardRef:i}=I();return(n,o)=>E(r)?.modal.value?(x(),a(E(B),{key:0,present:n.forceMount||E(r).open.value},{default:t(()=>[e(Re,v(n.$attrs,{ref:E(i),as:n.as,"as-child":n.asChild}),{default:t(()=>[k(n.$slots,`default`)]),_:3},16,[`as`,`as-child`])]),_:3},8,[`present`])):_(`v-if`,!0)}}),Z=b({__name:`DialogPortal`,props:{to:{type:null,required:!1},disabled:{type:Boolean,required:!1},defer:{type:Boolean,required:!1},forceMount:{type:Boolean,required:!1}},setup(e){let n=e;return(e,r)=>(x(),a(E(fe),m(T(n)),{default:t(()=>[k(e.$slots,`default`)]),_:3},16))}}),Be=b({__name:`DialogTitle`,props:{asChild:{type:Boolean,required:!1},as:{type:null,required:!1,default:`h2`}},setup(e){let n=e,r=X();return I(),(e,i)=>(x(),a(E(R),v(n,{id:E(r).titleId}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16,[`id`]))}}),Ve=b({__name:`Dialog`,props:{open:{type:Boolean},defaultOpen:{type:Boolean},modal:{type:Boolean}},emits:[`update:open`],setup(e,{emit:n}){let r=z(e,n);return(e,n)=>(x(),a(E(Me),v({"data-slot":`dialog`},E(r)),{default:t(t=>[k(e.$slots,`default`,m(T(t)))]),_:3},16))}}),He=b({__name:`DialogOverlay`,props:{forceMount:{type:Boolean},asChild:{type:Boolean},as:{},class:{}},setup(e){let n=e,r=A(n,`class`);return(e,i)=>(x(),a(E(ze),v({"data-slot":`dialog-overlay`},E(r),{class:E(V)(`data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/80`,n.class)}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16,[`class`]))}}),Ue=b({inheritAttrs:!1,__name:`DialogContent`,props:{forceMount:{type:Boolean},disableOutsidePointerEvents:{type:Boolean},asChild:{type:Boolean},as:{},class:{},showCloseButton:{type:Boolean,default:!0}},emits:[`escapeKeyDown`,`pointerDownOutside`,`focusOutside`,`interactOutside`,`openAutoFocus`,`closeAutoFocus`],setup(n,{emit:r}){let i=n,o=r,s=z(A(i,`class`),o);return(r,o)=>(x(),a(E(Z),null,{default:t(()=>[e(He),e(E(Le),v({"data-slot":`dialog-content`},{...r.$attrs,...E(s)},{class:E(V)(`bg-background data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 fixed top-[50%] left-[50%] z-50 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%] gap-4 rounded-lg border p-6 shadow-lg duration-200 sm:max-w-lg`,i.class)}),{default:t(()=>[k(r.$slots,`default`),n.showCloseButton?(x(),a(E(Ne),{key:0,"data-slot":`dialog-close`,class:`ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4`},{default:t(()=>[e(E(ve)),o[0]||=D(`span`,{class:`sr-only`},`Close`,-1)]),_:1})):_(``,!0)]),_:3},16,[`class`])]),_:3}))}}),We=b({__name:`DialogHeader`,props:{class:{}},setup(e){let t=e;return(e,n)=>(x(),h(`div`,{"data-slot":`dialog-header`,class:g(E(V)(`flex flex-col gap-2 text-center sm:text-left`,t.class))},[k(e.$slots,`default`)],2))}}),Ge=b({__name:`DialogTitle`,props:{asChild:{type:Boolean},as:{},class:{}},setup(e){let n=e,r=H(A(n,`class`));return(e,i)=>(x(),a(E(Be),v({"data-slot":`dialog-title`},E(r),{class:E(V)(`text-lg leading-none font-semibold`,n.class)}),{default:t(()=>[k(e.$slots,`default`)]),_:3},16,[`class`]))}}),Ke={class:`flex flex-col h-full bg-white text-gray-900 font-mono text-sm overflow-hidden border border-gray-200`},Q={class:`flex items-center justify-between px-4 py-2 border-b border-gray-300 bg-gray-50`},qe={class:`flex items-center gap-2`},Je=[`title`],Ye={class:`flex items-center gap-2`},Xe={class:`flex items-start gap-2 py-1`},Ze=[`onClick`,`title`],Qe={class:`flex-1 min-w-0`},$e={class:`flex flex-wrap gap-2`},$={key:0,class:`text-gray-500 italic p-4 select-none text-center`},et={class:`flex-1 overflow-auto space-y-4 font-mono text-sm`},tt={key:0},nt={class:`text-gray-900 bg-gray-50 p-2 rounded`},rt={key:1},it={class:`text-gray-900 bg-gray-50 p-2 rounded break-all`},at={class:`flex flex-wrap gap-2`},ot={key:2},st={class:`text-sm text-gray-800 bg-gray-50 p-4 rounded overflow-auto border border-gray-200 whitespace-pre-wrap break-all select-all font-mono leading-relaxed`},ct=b({__name:`ConsolePanel`,props:{logs:{}},emits:[`clear`,`expand`],setup(n,{emit:i}){let o=n,s=i,c=f(!1);function l(){c.value=!c.value,s(`expand`,c.value)}let d=f(),m=f(null),v=f(!1),y=f(!1);function b(e){switch(e){case`error`:return`text-red-700`;case`warn`:return`text-yellow-700`;case`info`:return`text-blue-700`;default:return`text-gray-900`}}function S(e){if(typeof e==`object`&&e){if(e.message!==void 0&&e.stack!==void 0&&Object.keys(e).length===2)return e.message;try{return JSON.stringify(e)}catch{return String(e)}}return String(e)}function C(e){m.value=e,v.value=!0}async function T(){let e=o.logs.map(e=>`${e.timestamp?`[${e.timestamp}] `:``}${e.method.toUpperCase()}: ${e.args.map(e=>S(e)).join(` `)}`).join(`
`);try{await navigator.clipboard.writeText(e),y.value=!0,setTimeout(()=>{y.value=!1},2e3)}catch(e){console.error(`复制失败:`,e)}}return r(()=>o.logs.length,()=>{w(()=>{d.value&&(d.value.scrollTop=d.value.scrollHeight)})}),(r,i)=>(x(),h(`div`,Ke,[D(`div`,Q,[D(`div`,qe,[D(`button`,{onClick:l,class:`p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors`,title:c.value?`折叠`:`展开`},[c.value?(x(),a(E(N),{key:1,size:16})):(x(),a(E(le),{key:0,size:16}))],8,Je),i[2]||=D(`span`,{class:`font-semibold select-none text-gray-900`},`控制台`,-1)]),D(`div`,Ye,[D(`button`,{onClick:T,class:`p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors`,title:`复制日志`},[y.value?(x(),a(E(ie),{key:0,size:16,class:`text-green-600`})):(x(),a(E(ge),{key:1,size:16}))]),D(`button`,{onClick:i[0]||=e=>r.$emit(`clear`),class:`p-1.5 text-gray-700 hover:text-gray-900 hover:bg-gray-200 rounded transition-colors`,title:`清除日志`},[e(E(_e),{size:16})])])]),D(`div`,{ref_key:`scrollContainer`,ref:d,class:`flex-1 overflow-auto p-3`},[(x(!0),h(p,null,O(n.logs,(e,t)=>(x(),h(`div`,{key:t,class:g([`border-b border-gray-200 last:border-b-0`,b(e.method)])},[D(`div`,Xe,[e.timestamp?(x(),h(`button`,{key:0,onClick:t=>C(e),class:`font-mono text-xs text-gray-600 hover:text-gray-900 hover:underline cursor-pointer shrink-0 mt-0.5`,title:e.caller||e.stack?`点击查看详情`:``},u(e.timestamp),9,Ze)):_(``,!0),D(`div`,Qe,[D(`div`,$e,[(x(!0),h(p,null,O(e.args,(e,t)=>(x(),h(`span`,{key:t,class:`text-sm whitespace-pre-wrap select-text`},u(S(e)),1))),128))])])])],2))),128)),n.logs.length===0?(x(),h(`div`,$,` No logs available `)):_(``,!0)],512),e(E(Ve),{open:v.value,"onUpdate:open":i[1]||=e=>v.value=e},{default:t(()=>[e(E(Ue),{class:`sm:max-w-10/12 lg:max-w-6xl h-[80vh] overflow-hidden flex flex-col`},{default:t(()=>[e(E(We),null,{default:t(()=>[e(E(Ge),{class:`flex items-center gap-2`},{default:t(()=>[D(`span`,{class:g(b(m.value?.method||`log`))},u(m.value?.method?.toUpperCase()||`LOG`),3),i[3]||=D(`span`,{class:`text-gray-500 text-sm font-normal`},` - 日志详情 `,-1)]),_:1})]),_:1}),D(`div`,et,[m.value?.timestamp?(x(),h(`div`,tt,[i[4]||=D(`div`,{class:`text-xs font-semibold text-gray-600 mb-1`},`时间`,-1),D(`div`,nt,u(m.value.timestamp),1)])):_(``,!0),m.value?.caller?(x(),h(`div`,rt,[i[5]||=D(`div`,{class:`text-xs font-semibold text-gray-600 mb-1`},`调用者`,-1),D(`div`,it,u(m.value.caller),1)])):_(``,!0),D(`div`,null,[i[6]||=D(`div`,{class:`text-xs font-semibold text-gray-600 mb-1`},`内容`,-1),D(`div`,{class:g([`p-2 rounded bg-gray-50 select-text`,b(m.value?.method||`log`)])},[D(`div`,at,[(x(!0),h(p,null,O(m.value?.args||[],(e,t)=>(x(),h(`span`,{key:t,class:`whitespace-pre-wrap`},u(S(e)),1))),128))])],2)]),m.value?.stack?(x(),h(`div`,ot,[i[7]||=D(`div`,{class:`text-xs font-semibold text-gray-600 mb-1`},`堆栈信息`,-1),D(`pre`,st,u(m.value.stack),1)])):_(``,!0)])]),_:1})]),_:1},8,[`open`])]))}}),lt={class:`cursor-diff-buttons`},ut=S(b({__name:`DiffActionButtons`,props:{change:{},onAccept:{type:Function},onUndo:{type:Function}},setup(e){let t=e,n=()=>{t.onAccept&&t.onAccept(t.change)},r=()=>{t.onUndo&&t.onUndo(t.change)};return(e,t)=>(x(),h(`div`,lt,[D(`button`,{class:`cursor-btn undo-btn`,onClick:r,title:`Undo Change`},` 取消 `),D(`button`,{class:`cursor-btn keep-btn`,onClick:n,title:`Keep Code Suggestion`},` 接受 `)]))}}),[[`__scopeId`,`data-v-48754213`]]),dt={key:0,class:`cursor-bottom-navigation`},ft={class:`cursor-nav-container`},pt={class:`nav-section`},mt=[`disabled`],ht={class:`change-counter`},gt=[`disabled`],_t={class:`action-section`},vt=S(b({__name:`DiffBottomNavigation`,props:{currentIndex:{},totalChanges:{},isPrevDisabled:{type:Boolean,default:!1},isNextDisabled:{type:Boolean,default:!1}},emits:[`previous`,`next`,`acceptAll`,`undoAll`,`close`],setup(t){let n=t;return(r,i)=>t.totalChanges>0?(x(),h(`div`,dt,[D(`div`,ft,[D(`div`,pt,[D(`button`,{class:`nav-btn prev-btn`,onClick:i[0]||=e=>r.$emit(`previous`),disabled:n.isPrevDisabled,title:`Previous Change`},[e(E(le),{class:`w-4 h-4`})],8,mt),D(`div`,ht,u(n.currentIndex+1)+` / `+u(n.totalChanges),1),D(`button`,{class:`nav-btn next-btn`,onClick:i[1]||=e=>r.$emit(`next`),disabled:n.isNextDisabled,title:`Next Change`},[e(E(N),{class:`w-4 h-4`})],8,gt)]),D(`div`,_t,[D(`button`,{class:`action-btn undo-all-btn`,onClick:i[2]||=e=>r.$emit(`undoAll`),title:`Undo all`},` 取消全部 `),D(`button`,{class:`action-btn keep-all-btn`,onClick:i[3]||=e=>r.$emit(`acceptAll`),title:`Keep all`},` 接受全部 `)])])])):_(``,!0)}}),[[`__scopeId`,`data-v-8066c615`]]),yt={class:`flex flex-col h-full w-full relative`},bt=S(b({__name:`ImmersiveDiffEditor`,props:{original:{type:String,default:``},modified:{type:String,default:``},language:{type:String,default:`javascript`},theme:{type:String,default:`vs`},fontSize:{type:Number,default:14},readonly:{type:Boolean,default:!1}},emits:[`update:original`,`save`,`close`,`font-size-change`],setup(e,{expose:t,emit:n}){let i=e,o=n,s=f(null),c=d(null),u=f([]),p=null,m=!1,g=f(0),v=f(0),b=f([]),S=f(!1),C=f(!1),w=f(!1);ee(async()=>{if(!s.value)return;p=await W();let e=p.editor.createModel(i.original,i.language),t=p.editor.createModel(i.modified,i.language);e.updateOptions({tabSize:2,indentSize:2,insertSpaces:!0}),t.updateOptions({tabSize:2,indentSize:2,insertSpaces:!0}),c.value=p.editor.createDiffEditor(s.value,{originalEditable:!i.readonly,readOnly:i.readonly,renderSideBySide:!1,ignoreTrimWhitespace:!1,automaticLayout:!0,theme:i.theme,minimap:{enabled:!1},scrollBeyondLastLine:!0,fontSize:i.fontSize,fontWeight:`bold`,roundedSelection:!1,scrollbar:{verticalScrollbarSize:10,horizontalScrollbarSize:10}}),c.value.setModel({original:e,modified:t});let n=c.value.getOriginalEditor(),r=c.value.getModifiedEditor(),a={fontSize:i.fontSize,fontWeight:`bold`,scrollBeyondLastLine:!0,roundedSelection:!1,scrollbar:{verticalScrollbarSize:10,horizontalScrollbarSize:10},tabSize:2,wordWrap:`off`,quickSuggestions:{other:`on`,comments:!1,strings:!1},parameterHints:{enabled:!0},suggestOnTriggerCharacters:!0,acceptSuggestionOnCommitCharacter:!0,acceptSuggestionOnEnter:`on`,wordBasedSuggestions:`allDocuments`,suggest:{showKeywords:!0,showSnippets:!0,showClasses:!0,showFunctions:!0,showVariables:!0,showModules:!0,showProperties:!0,showValues:!0,showConstants:!0,showMethods:!0}};n.updateOptions({...a,lineNumbers:`off`}),r.updateOptions({...a,lineNumbers:`on`}),c.value.onDidUpdateDiff(()=>{A()}),r.onDidScrollChange(()=>{g.value>0&&k()}),e.onDidChangeContent(()=>{m||o(`update:original`,e.getValue())}),setTimeout(()=>{A()},200);let l=r.getDomNode();l&&l.addEventListener(`wheel`,T,{passive:!1})});function T(e){if(e.ctrlKey&&c.value&&p){e.preventDefault();let t=c.value.getModifiedEditor(),n=t.getOption(p.editor.EditorOption.fontSize),r=e.deltaY>0?-1:1,i=Math.max(8,Math.min(30,n+r));c.value.getOriginalEditor().updateOptions({fontSize:i}),t.updateOptions({fontSize:i}),o(`font-size-change`,i)}}y(()=>{E()});let E=()=>{if(!c.value)return;let e=c.value.getModifiedEditor();u.value.forEach(t=>{let n=t.getDomNode();n&&l(null,n),e.removeContentWidget(t)}),u.value=[]},O=(e,t)=>{let n,r=p.editor.ContentWidgetPositionPreference.BELOW;if(e.modifiedEndLineNumber===0&&e.modifiedStartLineNumber>0?(n=e.modifiedStartLineNumber+1,r=p.editor.ContentWidgetPositionPreference.EXACT):n=e.modifiedEndLineNumber>0?e.modifiedEndLineNumber:e.modifiedStartLineNumber>0?e.modifiedStartLineNumber:e.originalStartLineNumber>0?e.originalStartLineNumber:e.originalEndLineNumber>0?e.originalEndLineNumber:1,t){let e=t.getModel?.();if(e){let t=e.getLineCount();n=t>0?Math.min(Math.max(n,1),t):1}}return n<=0?{lineNumber:1,positionPreference:r}:{lineNumber:n,positionPreference:r}},k=()=>{if(!c.value||g.value===0){S.value=!0,C.value=!0;return}let e=b.value[v.value];if(!e){S.value=!0,C.value=!0;return}let t=c.value.getModifiedEditor(),{lineNumber:n}=O(e,t),r=t.getVisibleRanges();if(r.length===0||!r[0]){g.value===1&&!w.value&&(w.value=!0,setTimeout(()=>{oe(0)},100)),S.value=v.value===0,C.value=v.value===g.value-1;return}let i=r[0],a=i.startLineNumber,o=i.endLineNumber,s=n>=a&&n<=o;g.value===1?(s?(S.value=!0,C.value=!0):n<a?(S.value=!1,C.value=!0):(S.value=!0,C.value=!1),!w.value&&!s&&(w.value=!0,setTimeout(()=>{oe(0)},100))):(S.value=v.value===0,C.value=v.value===g.value-1)},A=()=>{if(!c.value||!p)return;E();let e=c.value.getLineChanges()||[];b.value=e;let t=g.value;if(g.value=e.length,t!==g.value&&(w.value=!1),e.forEach(e=>{j(e)}),v.value>=g.value&&(v.value=Math.max(0,g.value-1)),setTimeout(()=>{k()},150),t>0&&g.value===0){console.log(`✅ [ImmersiveDiffEditor] 所有 diff 变化已处理完成，自动退出 diff 模式`);let e=c.value.getOriginalEditor().getModel();e&&o(`save`,e.getValue())}},j=e=>{if(!c.value||!p||i.readonly)return;let t=c.value.getModifiedEditor(),{lineNumber:n,positionPreference:r}=O(e,t),a=t.getLayoutInfo().contentWidth;a<100&&(a=800);let o=document.createElement(`div`);o.style.position=`absolute`,o.style.pointerEvents=`auto`,o.style.zIndex=`100`;let s=document.createElement(`div`);s.style.display=`flex`,s.style.width=`${a-80}px`,s.style.justifyContent=`flex-end`,s.style.alignItems=`center`,o.appendChild(s),l(te(ut,{change:e,onAccept:e=>ne(e),onUndo:e=>re(e)}),s);let d={getId:()=>`diff.action.buttons.${n}`,getDomNode:()=>o,getPosition:()=>({position:{lineNumber:n,column:1},positionAffinity:p.editor.PositionAffinity.RightOfInjectedText,preference:[r]})};t.addContentWidget(d),u.value.push(d)},ne=e=>{if(!c.value)return;let t=c.value.getOriginalEditor().getModel(),n=c.value.getModifiedEditor().getModel();if(!t||!n)return;m=!0;let r=t.getValue(),i=n.getValue(),a=r.split(`
`),o=i.split(`
`),s=e.originalStartLineNumber-1,l=e.originalEndLineNumber,u=e.modifiedStartLineNumber-1,d=e.modifiedEndLineNumber,f=[...a.slice(0,s),...o.slice(u,d),...a.slice(l)].join(`
`);t.setValue(f),setTimeout(()=>{m=!1,A()},100)},re=e=>{if(!c.value)return;let t=c.value.getOriginalEditor().getModel(),n=c.value.getModifiedEditor().getModel();if(!t||!n)return;m=!0;let r=t.getValue(),i=n.getValue(),a=r.split(`
`),o=i.split(`
`),s=e.originalStartLineNumber-1,l=e.originalEndLineNumber,u=e.modifiedStartLineNumber-1,d=e.modifiedEndLineNumber,f=[...o.slice(0,u),...a.slice(s,l),...o.slice(d)];n.setValue(f.join(`
`)),m=!1,setTimeout(()=>A(),100)},ie=()=>{if(!c.value)return;let e=c.value.getModifiedEditor().getModel(),t=c.value.getOriginalEditor().getModel();if(e&&t){m=!0;let n=e.getValue();t.setValue(n),m=!1,o(`save`,n)}},ae=()=>{if(!c.value)return;let e=c.value.getModifiedEditor().getModel(),t=c.value.getOriginalEditor().getModel();e&&t&&(m=!0,e.setValue(t.getValue()),m=!1,o(`close`))},oe=e=>{if(!c.value||e<0||e>=b.value.length)return;let t=b.value[e];v.value=e;let n=c.value.getModifiedEditor(),r=t.modifiedStartLineNumber>0?t.modifiedStartLineNumber:t.originalStartLineNumber,i=r>0?r:1;n.revealLineInCenter(i),n.setPosition({lineNumber:i,column:1}),n.focus(),setTimeout(()=>{k()},100)},se=()=>{oe((v.value+1)%g.value)},ce=()=>{oe((v.value-1+g.value)%g.value)};r(()=>i.theme,e=>{p&&p.editor.setTheme(e)}),r(()=>i.fontSize,e=>{if(c.value){let t=c.value.getOriginalEditor(),n=c.value.getModifiedEditor();t.updateOptions({fontSize:e}),n.updateOptions({fontSize:e})}}),r(()=>i.readonly,e=>{c.value&&(c.value.updateOptions({originalEditable:!e,readOnly:e}),e?E():A())}),r(()=>[i.original,i.modified],([e,t])=>{if(!c.value)return;let n=c.value.getOriginalEditor().getModel(),r=c.value.getModifiedEditor().getModel();if(n&&r){let i=e??``,a=t??``,o=n.getValue(),s=r.getValue();o!==i&&(m=!0,n.setValue(i),m=!1),s!==a&&r.setValue(a),setTimeout(()=>{A()},100)}},{deep:!0});function le(){return!c.value||!p?i.fontSize:c.value.getModifiedEditor().getOption(p.editor.EditorOption.fontSize)}function ue(e){if(!c.value)return;let t=c.value.getOriginalEditor(),n=c.value.getModifiedEditor();t.updateOptions({fontSize:e}),n.updateOptions({fontSize:e})}return t({handleAcceptAll:ie,getFontSize:le,setFontSize:ue,getDiffEditor:()=>c.value}),(t,n)=>(x(),h(`div`,yt,[D(`div`,{class:`h-full w-full relative`,ref_key:`container`,ref:s},null,512),e.readonly?_(``,!0):(x(),a(vt,{key:0,"current-index":v.value,"total-changes":g.value,"is-prev-disabled":S.value,"is-next-disabled":C.value,onNext:se,onPrevious:ce,onAcceptAll:ie,onUndoAll:ae,onClose:n[0]||=e=>t.$emit(`close`)},null,8,[`current-index`,`total-changes`,`is-prev-disabled`,`is-next-disabled`]))]))}}),[[`__scopeId`,`data-v-5ba029a3`]]),xt=b({__name:`LoadingProgressBar`,props:{isLoading:{type:Boolean,default:!1},isError:{type:Boolean,default:!1}},setup(e){let t=e,n=o(()=>t.isError?`bg-red-500`:`bg-blue-500`),r=o(()=>t.isLoading||t.isError);return(e,t)=>(x(),h(`div`,{class:g([`h-0.5 w-full transition-all duration-300 overflow-hidden`,r.value?`opacity-100`:`opacity-0`])},[D(`div`,{class:g([`h-full transition-all duration-300`,n.value,r.value?`w-full`:`w-0`])},null,2)],2))}}),St={key:0,class:`error-notification absolute bottom-4 left-4 z-50 max-w-md bg-white rounded-lg overflow-hidden`},Ct={class:`absolute top-2 right-2 z-10`},wt={class:`p-4 pr-10`},Tt={class:`text-sm text-slate-700 mb-3 wrap-break-word`},Et={class:`flex items-center gap-2`},Dt=S(b({__name:`ErrorNotification`,props:{errorMessage:{}},emits:[`close`,`fix`,`copy`],setup(n,{emit:i}){let o=n,s=i,l=f(!1),d=f(!1),p=f(null);r(()=>o.errorMessage,e=>{e?(p.value&&clearTimeout(p.value),l.value=!0,d.value=!1):l.value=!1},{immediate:!0});function m(){l.value=!1,s(`close`)}function g(){s(`fix`)}async function v(){if(o.errorMessage)try{await navigator.clipboard.writeText(`<error_message>${o.errorMessage}</error_message>`),d.value=!0,setTimeout(()=>{d.value=!1},2e3),s(`copy`)}catch(e){console.error(`复制失败:`,e)}}return(r,i)=>(x(),a(c,{name:`error-notification`},{default:t(()=>[l.value&&n.errorMessage?(x(),h(`div`,St,[D(`div`,Ct,[D(`button`,{onClick:m,class:`p-1 text-slate-400 hover:text-slate-600 transition rounded hover:bg-slate-100`,title:`关闭`},[e(E(ve),{class:`w-4 h-4`})])]),D(`div`,wt,[i[1]||=D(`div`,{class:`flex items-center gap-2 mb-2`},[D(`div`,{class:`w-2 h-2 rounded-full bg-red-500`}),D(`span`,{class:`text-sm font-semibold text-red-700`},`错误`)],-1),D(`div`,Tt,u(n.errorMessage),1),D(`div`,Et,[D(`button`,{onClick:g,class:`flex items-center gap-1.5 px-3 py-1.5 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition text-sm font-medium`},[e(E(G),{class:`w-3.5 h-3.5`}),i[0]||=D(`span`,null,`修复`,-1)]),D(`button`,{onClick:v,class:`flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 text-slate-700 rounded-md hover:bg-slate-200 transition text-sm font-medium`},[d.value?(x(),a(E(ie),{key:0,class:`w-3.5 h-3.5 text-green-600`})):(x(),a(E(ge),{key:1,class:`w-3.5 h-3.5`})),D(`span`,null,u(d.value?`已复制`:`复制`),1)])])])])):_(``,!0)]),_:1}))}}),[[`__scopeId`,`data-v-1ca35c6d`]]),Ot={class:`flex flex-col w-full h-full bg-slate-50 border border-slate-200 rounded-xl overflow-hidden shadow-sm`},kt={class:`flex items-center justify-between px-4 py-2 bg-white border-b border-slate-100 z-20`},At={class:`flex items-center space-x-4`},jt={class:`flex items-center space-x-2 text-slate-700 font-semibold select-none`},Mt={class:`max-w-[200px] truncate`},Nt={key:0,class:`flex items-center space-x-1 pl-4 border-l border-slate-200`},Pt=[`disabled`],Ft=[`disabled`],It={class:`flex flex-col text-xs`},Lt={class:`font-medium truncate`},Rt={class:`text-[10px] text-gray-400`},zt={class:`flex items-center space-x-3`},Bt=[`title`],Vt={class:`flex items-center bg-slate-100 rounded-lg p-1`},Ht={key:1,class:`flex items-center space-x-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition text-sm font-medium`},Ut={class:`flex-1 flex flex-col overflow-hidden relative`},Wt={class:`flex-1 overflow-hidden relative z-0`},Gt={key:0,class:`flex-1 overflow-hidden relative z-0`},Kt={class:`flex-1 overflow-hidden bg-slate-50 relative z-0`},qt={class:`w-full h-full bg-white overflow-hidden relative ring-4`},Jt=b({__name:`ImmersiveCode`,props:{initialCode:{},enableShare:{type:Boolean},readonly:{type:Boolean},title:{}},emits:[`error`,`element-selected`,`ctrl-i-pressed`,`diff-exited`,`error-fix`],setup(n,{expose:i,emit:c}){let l=n,d=c,{versions:m,currentVersionIndex:v,currentCode:b,currentDiffTarget:S,currentRecord:T,canUndo:te,canRedo:A,record:j,addMajorVersion:ne,addMajorDiffVersion:re,undo:ie,redo:ae,switchVersion:se,getHistory:le,setHistory:ue}=De(l.initialCode??`<!DOCTYPE html>\r
<html lang="en">\r
\r
<head>\r
  <meta charset="UTF-8">\r
  <meta name="viewport" content="width=device-width, initial-scale=1.0">\r
  <title>Demo</title>\r
</head>\r
\r
<body>\r
  Hello World\r
</body>\r
\r
</html>`),{applyDiff:fe}=Oe(),M=f(`code`),N=f(!1),ge=f(!1),_e=f([]),ve=f(0),P=f(b.value),F=f(14),I=f(!1),L=null,R=f(!1),z=f(!1),B=f(!1),V=f(!1),H=f(!1),U=f(``),W=f(null),G=null,ke=!1,K=f(null),q=f(null),J=f(null),Y=o(()=>{if(S.value){let e=T.value,t=b.value;return e?.originalCode&&t.trim()!==``&&t.trim()!==e.originalCode.trim()?M.value:`diff`}return M.value}),X=o(()=>B.value?U.value||P.value:b.value);r(()=>Y.value,async(e,t)=>{if(t===`code`&&e===`diff`){await w();let e=K.value?.getEditor();if(e){let t=K.value?.getMonaco();if(t){let n=e.getOption(t.editor.EditorOption.fontSize);F.value=n,setTimeout(()=>{q.value&&q.value.setFontSize(n)},100)}}}else if(t===`diff`&&e===`code`&&q.value){let e=q.value.getFontSize();F.value=e,await w();let t=K.value?.getEditor();t&&t.updateOptions({fontSize:e})}});let je=f({content:``,success:!0});r([S,b],()=>{if(!S.value){je.value={content:``,success:!0},$();return}let e=T.value,t=b.value;if(Y.value!==`diff`){console.log(`🔄 [ImmersiveCode] Skip auto diff: code already includes applied diff`,{recordId:e?.id}),je.value={content:t,success:!0},$();return}let n=e?.originalCode??t;console.log(`🔄 [ImmersiveCode] Applying diff:`,{baseCodeLength:n.length,currentCodeLength:t.length,diffTargetLength:S.value.length,diffTargetPreview:S.value.substring(0,200),fullDiffTarget:S.value});let r=fe(n,S.value);je.value=r,console.log(`📊 [ImmersiveCode] Diff application result:`,{success:r.success,message:r.message,appliedCount:r.appliedCount,failedBlocks:r.failedBlocks,resultContentLength:r.content.length,resultContentPreview:r.content.substring(0,200)}),r.success||(console.warn(`⚠️ [ImmersiveCode] Failed to apply stored diff to current code:`,r.message,{currentCode:b.value.substring(0,200),diffTarget:S.value,failedBlocks:r.failedBlocks}),$())},{immediate:!0});let Me=o(()=>S.value?je.value.success?je.value.content:b.value:``),Ne=f(!1);function Pe(){console.log(`🌊 [ImmersiveCode] Starting streaming mode`),B.value=!0,ke=!1,G&&=(clearTimeout(G),null),U.value=P.value}function Fe(){console.log(`🌊 [ImmersiveCode] Ending streaming mode`),B.value=!1,ke=!1,G&&=(clearTimeout(G),null),U.value=P.value,Y.value===`code`?j(P.value,void 0,!0):Y.value===`diff`?j(P.value,S.value,!0):Y.value===`preview`&&j(P.value,void 0,!0)}function Ie(e){if(!B.value){console.warn(`⚠️ [ImmersiveCode] streamWrite called but not in streaming mode`);return}console.log(`🌊 [ImmersiveCode] streamWrite called:`,{codeLength:e.length,mode:Y.value,hasCodeEditorRef:!!K.value}),P.value=e,w(()=>{if(Y.value===`code`&&K.value){let t=K.value.getEditor();if(t){let n=t.getValue();n===e?console.log(`🌊 [ImmersiveCode] Editor value unchanged, skipping update`):(console.log(`🌊 [ImmersiveCode] Updating editor value:`,{currentLength:n.length,newLength:e.length}),t.setValue(e))}else console.warn(`⚠️ [ImmersiveCode] Editor not available`)}else if(Y.value===`diff`&&q.value){let t=q.value.getDiffEditor();if(t){let n=t.getModifiedEditor().getModel();n&&n.getValue()!==e&&n.setValue(e)}}else Y.value===`preview`?console.log(`🌊 [ImmersiveCode] Preview mode: editorValue updated`):console.warn(`⚠️ [ImmersiveCode] Cannot update editor:`,{mode:Y.value,hasCodeEditorRef:!!K.value,hasDiffEditorRef:!!q.value})})}function Le(e){console.log(`🔍 [ImmersiveCode] Selecting element in preview:`,e),M.value=`preview`,w(()=>{let t=(n=0)=>{J.value?.selectElementBySelector?(J.value.selectElementBySelector(e),console.log(`✅ [ImmersiveCode] Element selected in preview`)):n<20?setTimeout(()=>{t(n+1)},100):console.warn(`⚠️ [ImmersiveCode] Failed to select element after max retries`)};t()})}function Re(e,t,n,r=0){console.log(`📝 [ImmersiveCode] Setting code and selecting lines:`,{codeLength:e.length,startLine:t,endLine:n,retryCount:r}),M.value=`code`,w(()=>{I.value=!0,j(e),P.value=e,w(()=>{let i=K.value?.getEditor(),a=K.value?.getMonaco();if(i&&a){let e=i.getModel();if(!e){setTimeout(()=>{I.value=!1},100);return}let r=e.getLineCount(),a=Math.max(1,Math.min(t,r)),o=Math.max(a,Math.min(n,r));i.setSelection({startLineNumber:a,startColumn:1,endLineNumber:o,endColumn:e.getLineMaxColumn(o)}),i.revealLineInCenter(a),o!==a&&i.revealLineInCenter(o),setTimeout(()=>{I.value=!1},100),console.log(`✅ [ImmersiveCode] Code set and lines selected:`,{safeStartLine:a,safeEndLine:o})}else r<10?(console.warn(`⚠️ [ImmersiveCode] Editor not ready yet, retrying... (${r+1}/10)`),setTimeout(()=>{Re(e,t,n,r+1)},100)):(console.error(`❌ [ImmersiveCode] Failed to set code after max retries`),setTimeout(()=>{I.value=!1},100))})})}function ze(){if(v.value>0){let e=m.value[v.value-1];if(e&&e.records&&e.records.length>0){let t=e.currentIndex??e.records.length-1;return e.records[t]?.code||``}}let e=m.value[v.value];if(e&&e.records&&e.records.length>1){let t=(e.currentIndex??e.records.length-1)-1;if(t>=0)return e.records[t]?.code||``}return``}i({addMajorVersion:(e,t)=>ne(e||P.value||b.value,t),addMajorDiffVersion:(e,t,n,r)=>{console.group(`🔄 [ImmersiveCode] Adding Major Diff Version`);let i=fe(e,t);return i.success?(re(e,t,n,r),Ne.value=!0,console.log(`✅ [ImmersiveCode] Major Diff Version created and diff mode activated`),console.groupEnd(),{success:!0,message:`Major Diff Version created.`}):(console.warn(`⚠️ [ImmersiveCode] Diff (Dry Run) Failed:`,i.message),console.groupEnd(),{success:!1,appliedCount:i.appliedCount,message:i.message||`未找到可以應用的 Diff。`})},getCurrentCode:()=>P.value||b.value,getPreviousVersionCode:ze,diff:(e,t)=>{console.group(`🔄 [ImmersiveCode] Triggering Diff Mode (Raw)`);let n=t===void 0?b.value:t,r=fe(n,e);return r.success?(console.log(`Recording Raw Diff:`,{baseLen:n.length,diffLen:e.length}),j(n,e),Ne.value=!0,console.groupEnd(),{success:!0,message:`Opening Diff View with Raw Patch.`}):(console.warn(`⚠️ [ImmersiveCode] Diff (Dry Run) Failed:`,r.message),$({finalContent:n}),console.groupEnd(),{success:!1,appliedCount:r.appliedCount,message:r.message||`未找到可以應用的 Diff。`})},startStreaming:Pe,endStreaming:Fe,streamWrite:Ie,setCodeAndSelectLines:Re,selectElementInPreview:Le,getHistory:le,setHistory:ue,setError:e=>{W.value=e},refreshPreview:Q});let Z=null,Be=e=>{if(!B.value){if(I.value){Z&&=(clearTimeout(Z),null);return}Z&&clearTimeout(Z),Z=setTimeout(()=>{Y.value===`code`&&!I.value&&!B.value&&j(e),Z=null},800)}};r(P,e=>{Y.value===`code`&&Be(e),B.value&&(ke||(U.value=e,ke=!0,G=setTimeout(()=>{ke=!1,G=null,P.value!==U.value&&(U.value=P.value)},500)))}),r(b,e=>{e!==P.value&&(I.value=!0,Z&&=(clearTimeout(Z),null),L&&=(clearTimeout(L),null),P.value=e,w(()=>{L=setTimeout(()=>{I.value=!1,L=null},500)}))});function Ve(e,t){return!e||!t?e:e.replace(/about:srcdoc:(\d+)(:\d+)/gm,(e,n,r)=>{let i=parseInt(n,10);return i>t?`index.html:${i-t}${r}`:`index.html:${i}${r}`})}function He(e){let t=Ve(e.stack,e.lineOffset),n=Ve(e.caller,e.lineOffset),r={method:e.method||`log`,args:e.args||(e.message?[e.message]:[e]),timestamp:new Date().toLocaleTimeString(),caller:n,stack:t,lineOffset:e.lineOffset};if(_e.value.push(r),r.method===`error`){let e=`error: ${r.args?.[0]?.message}\nstack: ${r.stack}\ncaller: ${r.caller}`;d(`error`,e),W.value=e}}function Ue(){_e.value=[]}function We(e,t){d(`element-selected`,e,t)}function Ge(){N.value=!N.value}function Ke(e){z.value=e}function Q(){R.value=!0,V.value=!0,H.value=!1,ve.value++,Ue()}function qe(){R.value=!1,V.value=!1,H.value=!1}function Je(){R.value=!1,V.value=!1,H.value=!0,W.value=`预览加载失败：无法加载预览内容`,setTimeout(()=>{H.value=!1},2e3)}function Ye(){W.value=null}function Xe(){W.value=null,Y.value!==`preview`&&(M.value=`preview`),Q(),d(`error-fix`)}function Ze(){}r(()=>X.value,()=>{Y.value===`preview`&&(V.value=!0,H.value=!1)}),r(()=>Y.value,async e=>{e===`preview`?(V.value=!0,H.value=!1,await w(),J.value?.checkIfLoaded?J.value.checkIfLoaded()?(V.value=!1,H.value=!1):setTimeout(()=>{V.value&&Y.value===`preview`&&(V.value=!1)},500):setTimeout(()=>{V.value&&Y.value===`preview`&&J.value?.checkIfLoaded?.()&&(V.value=!1)},100)):(V.value=!1,H.value=!1)});function Qe(e){F.value=e}function $e(e){P.value=e,console.log(`📝 [ImmersiveCode] Code updated in Diff Mode. Clearing Diff Target.`),j(e,void 0)}function $(e){console.group(`👋 [ImmersiveCode] Exiting Diff Mode`);let t=e?.finalContent===void 0?b.value:e.finalContent,n=e?.enableEmit===void 0?!1:e.enableEmit,r=m.value[v.value]?.currentIndex===0;console.log(`Saving Final Content:`,t.substring(0,30)+`...`);let i=T.value?.id;j(t,void 0),M.value=`code`,Q(),n&&r&&d(`diff-exited`,t,i),console.groupEnd()}let et=o({get:()=>String(v.value),set:e=>se(Number(e))});function tt(e){return new Date(e).toLocaleTimeString()}let nt=o(()=>{let e=T.value;return e?(console.log(`record`,T.value),!!(e.originalCode&&e.diffTarget)):!1}),rt=o(()=>{let e=X.value;if(!e)return``;let t=e.match(/<title[^>]*>([^<]*)<\/title>/i);return t&&t[1]?t[1].trim():``}),it=o(()=>l.title&&l.title.trim()!==``?l.title:rt.value?rt.value:`Fixed Script`);function at(){let e=T.value;if(!e||!e.originalCode||!e.diffTarget)return;if(Y.value===`diff`){$();return}let t=e.originalCode,n=e.diffTarget,r=fe(t,n);r.success||console.warn(`⚠️ [ImmersiveCode] Backend diff (dry run) failed when toggling history diff:`,r.message),j(t,n)}function ot(e){let t=e.target;if((t.tagName===`INPUT`||t.tagName===`TEXTAREA`||t.isContentEditable)&&(t.closest(`.monaco-editor`)||t.closest(`[class*="monaco"]`))){if((e.ctrlKey||e.metaKey)&&(e.key===`s`||e.key===`S`)){e.preventDefault(),e.stopPropagation();return}if((e.ctrlKey||e.metaKey)&&(e.key===`r`||e.key===`R`)){e.preventDefault(),e.stopPropagation(),Q();return}if((e.ctrlKey||e.metaKey)&&(e.key==="`"||e.key===`Backquote`)){e.preventDefault(),e.stopPropagation(),N.value=!N.value;return}return}if((e.ctrlKey||e.metaKey)&&(e.key==="`"||e.key===`Backquote`)){e.preventDefault(),e.stopPropagation(),N.value=!N.value;return}if((e.ctrlKey||e.metaKey)&&(e.key===`s`||e.key===`S`)){e.preventDefault(),e.stopPropagation();return}if((e.ctrlKey||e.metaKey)&&(e.key===`r`||e.key===`R`)){e.preventDefault(),e.stopPropagation(),Q();return}}return ee(()=>{window.addEventListener(`keydown`,ot)}),y(()=>{window.removeEventListener(`keydown`,ot),G&&=(clearTimeout(G),null)}),(n,r)=>(x(),h(`div`,Ot,[D(`div`,kt,[D(`div`,At,[D(`div`,jt,[e(E(he),{class:`w-5 h-5 text-purple-600`}),D(`span`,Mt,u(it.value),1)]),l.readonly?_(``,!0):(x(),h(`div`,Nt,[D(`button`,{onClick:r[0]||=(...e)=>E(ie)&&E(ie)(...e),disabled:!E(te),class:`p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-600`,title:`Undo`},[e(E(Ee),{class:`w-4 h-4`})],8,Pt),D(`button`,{onClick:r[1]||=(...e)=>E(ae)&&E(ae)(...e),disabled:!E(A),class:`p-1.5 rounded-md hover:bg-slate-100 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-600`,title:`Redo`},[e(E(Se),{class:`w-4 h-4`})],8,Ft),e(E(oe),{modelValue:et.value,"onUpdate:modelValue":r[2]||=e=>et.value=e},{default:t(()=>[e(E(de),{class:`w-[160px] h-8 text-xs border-none bg-slate-50 px-4 hover:bg-slate-100 focus:ring-0 shadow-none`},{default:t(()=>[e(E(me),{placeholder:`Select Version`})]),_:1}),e(E(ce),{class:`max-h-[300px]`},{default:t(()=>[(x(!0),h(p,null,O(E(m),(e,n)=>(x(),a(E(pe),{key:e.id,value:String(n)},{default:t(()=>[D(`div`,It,[D(`span`,Lt,u(e.label),1),D(`span`,Rt,u(tt(e.timestamp)),1)])]),_:2},1032,[`value`]))),128))]),_:1})]),_:1},8,[`modelValue`]),nt.value?(x(),h(`button`,{key:0,onClick:at,class:`p-1.5 rounded-md hover:text-slate-600 disabled:opacity-30 disabled:hover:bg-transparent transition text-slate-400`,title:`查看历史 Diff`},[e(E(be),{class:`w-4 h-4`})])):_(``,!0)]))]),D(`div`,zt,[D(`button`,{onClick:r[3]||=e=>N.value=!N.value,class:g([`p-1.5 rounded transition`,N.value?`bg-purple-100 text-purple-700`:`text-slate-400 hover:text-slate-600`]),title:`Toggle Console`},[e(E(Te),{class:`w-4 h-4`})],2),Y.value===`preview`?(x(),h(p,{key:0},[D(`button`,{onClick:Q,class:`p-1.5 text-slate-400 hover:text-slate-600 transition`,title:`Refresh Preview`},[e(E(Ce),{class:g([`w-4 h-4 transition-transform duration-300`,R.value?`animate-spin`:``])},null,8,[`class`])]),D(`button`,{onClick:r[4]||=e=>z.value=!z.value,class:g([`p-1.5 rounded transition`,z.value?`bg-blue-100 text-blue-600 hover:bg-blue-200`:`text-slate-400 hover:text-slate-600`]),title:z.value?`Disable Element Selector`:`Enable Element Selector`},[e(E(xe),{class:`w-4 h-4`})],10,Bt)],64)):_(``,!0),D(`div`,Vt,[D(`button`,{onClick:r[5]||=e=>M.value=`code`,class:g([`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition`,[`code`,`diff`].includes(Y.value)?`bg-white text-slate-900 shadow-sm`:`text-slate-500 hover:text-slate-700`])},[...r[12]||=[D(`span`,null,`代码`,-1)]],2),D(`button`,{onClick:r[6]||=e=>M.value=`preview`,class:g([`flex items-center space-x-1 px-3 py-1 rounded-md text-sm font-medium transition`,Y.value===`preview`?`bg-white text-blue-600 shadow-sm`:`text-slate-500 hover:text-slate-700`])},[...r[13]||=[D(`span`,null,`预览`,-1)]],2)]),l.enableShare?(x(),h(`button`,Ht,[e(E(we),{class:`w-3.5 h-3.5`}),r[14]||=D(`span`,null,`分享`,-1)])):_(``,!0),k(n.$slots,`right-actions`)])]),Y.value===`preview`?(x(),a(xt,{key:0,"is-loading":V.value,"is-error":H.value},null,8,[`is-loading`,`is-error`])):_(``,!0),D(`div`,Ut,[C(D(`div`,Wt,[e(ye,{ref_key:`codeEditorRef`,ref:K,modelValue:P.value,"onUpdate:modelValue":r[7]||=e=>P.value=e,language:`html`,theme:`vs`,readonly:l.readonly,options:{fontSize:F.value},onFontSizeChange:Qe,onCtrlIPressed:r[8]||=e=>d(`ctrl-i-pressed`,e)},null,8,[`modelValue`,`readonly`,`options`])],512),[[s,Y.value===`code`]]),Y.value===`diff`?(x(),h(`div`,Gt,[e(bt,{ref_key:`diffEditorRef`,ref:q,original:E(b),modified:Me.value,language:`html`,theme:`vs`,readonly:l.readonly,"font-size":F.value,"onUpdate:original":$e,onSave:r[9]||=e=>$({finalContent:e,enableEmit:!0}),onClose:r[10]||=()=>$(),onFontSizeChange:Qe},null,8,[`original`,`modified`,`readonly`,`font-size`])])):_(``,!0),C(D(`div`,Kt,[D(`div`,qt,[(x(),a(Ae,{ref_key:`previewFrameRef`,ref:J,key:ve.value,code:X.value,"enable-element-selector":z.value,onConsoleLog:He,onElementSelected:We,onToggleConsole:Ge,onToggleElementSelector:Ke,onLoadComplete:qe,onLoadError:Je},null,8,[`code`,`enable-element-selector`]))])],512),[[s,Y.value===`preview`]]),N.value?(x(),h(`div`,{key:1,class:g([`absolute bottom-0 inset-x-0 z-10 shadow-[0_-4px_20px_rgba(0,0,0,0.1)] transition-all duration-300 transform bg-[#1e1e1e]`,ge.value?`top-0`:`h-48`])},[e(ct,{logs:_e.value,onClear:Ue,onExpand:r[11]||=e=>ge.value=e},null,8,[`logs`])],2)):_(``,!0),e(Dt,{"error-message":W.value,onClose:Ye,onFix:Xe,onCopy:Ze},null,8,[`error-message`])])]))}});export{G as n,Ce as r,Jt as t};