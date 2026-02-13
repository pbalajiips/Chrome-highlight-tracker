// Restore saved highlights when the page loads
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', restoreHighlights);
} else {
  restoreHighlights();
}

// Observe DOM changes to re-apply highlights on dynamic pages
let observerTimeout;
const observer = new MutationObserver((mutations) => {
  // Avoid infinite loops: check if the mutation was caused by our own highlighting
  const isOurMutation = mutations.some(m => 
    Array.from(m.addedNodes).some(n => n.nodeType === 1 && n.classList.contains('my-extension-highlight'))
  );
  if (isOurMutation) return;

  clearTimeout(observerTimeout);
  observerTimeout = setTimeout(restoreHighlights, 1000);
});

if (document.body) {
  observer.observe(document.body, { childList: true, subtree: true });
}

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    if (!chrome.runtime?.id) return;

    chrome.storage.local.get({ isPaused: false, userColor: '#ffff00' }, (result) => {
      if (result.isPaused) return;
      const color = result.userColor;

    // Attempt to highlight visually
    try {
      const range = selection.getRangeAt(0);
      safeHighlightRange(range, color);

      // Save the highlight to storage only if visual highlighting succeeds
      saveHighlight(selectedText, window.location.href, color);

      // Optional: Clear the blue selection box so the yellow stands out
      selection.removeAllRanges();
      
    } catch (error) {
      console.error("Highlighting failed: selection crosses complex boundaries.", error);
    }
    });
  }
});

function saveHighlight(text, url, color) {
  if (!chrome.runtime?.id) return;

  chrome.storage.local.get({ highlights: [] }, (result) => {
    const highlights = result.highlights;
    
    highlights.push({
      text: text,
      url: url,
      color: color,
      note: "",
      date: new Date().toLocaleString(),
      timestamp: Date.now()
    });

    // Update badge count for this page
    const pageHighlights = highlights.filter(h => h.url === url);
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({ action: "updateBadge", count: pageHighlights.length });
    }

    if (chrome.runtime?.id) {
      chrome.storage.local.set({ highlights: highlights }, () => {
        // console.log('Highlight saved!');
      });
    }
  });
}

function restoreHighlights() {
  if (!chrome.runtime?.id) return;

  chrome.storage.local.get({ highlights: [] }, (result) => {
    const highlights = result.highlights;
    if (!highlights) return;

    const currentUrl = window.location.href;
    // Filter highlights that belong to this specific page
    const pageHighlights = highlights.filter(h => h.url === currentUrl);

    // Update badge count
    if (chrome.runtime?.id) {
      chrome.runtime.sendMessage({ action: "updateBadge", count: pageHighlights.length });
    }
    
    // Save scroll position and selection to restore after highlighting
    // (window.find scrolls the page, so we need to reset it)
    const scrollX = window.scrollX;
    const scrollY = window.scrollY;
    const sel = window.getSelection();
    const savedRanges = [];
    for (let i = 0; i < sel.rangeCount; i++) {
      savedRanges.push(sel.getRangeAt(i));
    }

    pageHighlights.forEach(h => {
      findAndHighlight(h.text, h.color);
    });
    
    // Restore scroll and selection
    window.scrollTo(scrollX, scrollY);
    sel.removeAllRanges();
    savedRanges.forEach(r => sel.addRange(r));
  });
}

function findAndHighlight(searchText, color) {
  if (!searchText) return;

  // Reset selection to start of document to ensure we search from the top
  const sel = window.getSelection();
  sel.removeAllRanges();
  try {
    const range = document.createRange();
    range.setStart(document.body, 0);
    range.collapse(true);
    sel.addRange(range);
  } catch (e) { return; }

  // Use window.find() to search for text across multiple nodes (handles passages)
  // Args: string, caseSensitive, backwards, wrapAround, wholeWord, searchInFrames, showDialog
  while (window.find(searchText, false, false, false, false, false, false)) {
    const range = sel.getRangeAt(0);
    
    // Check if already highlighted (avoid infinite loop or double highlighting)
    const parent = range.startContainer.nodeType === 1 ? range.startContainer : range.startContainer.parentNode;
    if (parent.closest('.my-extension-highlight')) {
      sel.collapseToEnd();
      continue;
    }

    try {
      safeHighlightRange(range, color);
    } catch (e) {
      // Ignore errors if selection crosses complex boundaries
    }
    
    // Move selection to end of found text to continue searching
    sel.collapseToEnd();
  }
}

function safeHighlightRange(range, color) {
  const span = document.createElement('span');
  span.style.backgroundColor = color || '#ffff00';
  span.style.color = '#000000';
  span.className = 'my-extension-highlight';

  try {
    // Try simple wrapping first
    range.surroundContents(span);
  } catch (e) {
    // Fallback: Wrap individual text nodes for complex selections
    let root = range.commonAncestorContainer;
    if (root.nodeType === Node.TEXT_NODE) root = root.parentNode;

    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode: (node) => range.intersectsNode(node) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT
    });

    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);

    nodes.forEach(node => {
      const rng = document.createRange();
      rng.selectNodeContents(node);
      
      if (node === range.startContainer) rng.setStart(node, range.startOffset);
      if (node === range.endContainer) rng.setEnd(node, range.endOffset);
      
      if (!rng.collapsed) {
        const s = span.cloneNode(true);
        try { rng.surroundContents(s); } catch (err) {}
      }
    });
  }
}
