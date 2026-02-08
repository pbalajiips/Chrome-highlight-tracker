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
      const span = document.createElement('span');
      
      // Styling the highlight
      span.style.backgroundColor = color;
      span.style.color = '#000000';
      span.className = 'my-extension-highlight';
      
      // This command wraps the selected text with our styled span
      range.surroundContents(span);

      // Save the highlight to storage only if visual highlighting succeeds
      saveHighlight(selectedText, window.location.href, color);

      // Optional: Clear the blue selection box so the yellow stands out
      selection.removeAllRanges();
      
    } catch (error) {
      // surroundContents fails if the selection crosses multiple HTML tags (like <div> to <p>)
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

    pageHighlights.forEach(h => {
      findAndHighlight(h.text, h.color);
    });
  });
}

function findAndHighlight(searchText, color) {
  if (!searchText) return;

  // Use a TreeWalker to efficiently find text nodes containing the search text
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
  let node;

  while (node = walker.nextNode()) {
    // Skip if this text is already highlighted (prevents highlighting the same text twice)
    if (node.parentNode && node.parentNode.className === 'my-extension-highlight') continue;

    const index = node.nodeValue.indexOf(searchText);
    if (index >= 0) {
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + searchText.length);
      
      const span = document.createElement('span');
      span.style.backgroundColor = color || '#ffff00'; // Default to yellow if no color saved
      span.style.color = '#000000';
      span.className = 'my-extension-highlight';
      
      try {
        range.surroundContents(span);
        return; // Stop after finding the first match for this specific saved text
      } catch (e) {
        // Continue searching if wrapping failed (e.g. complex structure)
      }
    }
  }
}
