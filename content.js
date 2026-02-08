// Restore saved highlights when the page loads
restoreHighlights();

document.addEventListener('mouseup', () => {
  const selection = window.getSelection();
  const selectedText = selection.toString().trim();

  if (selectedText.length > 0) {
    chrome.storage.local.get({ isPaused: false }, (result) => {
      if (result.isPaused) return;

    // Attempt to highlight visually
    try {
      const range = selection.getRangeAt(0);
      const span = document.createElement('span');
      
      // Styling the highlight
      span.style.backgroundColor = '#ffff00'; // Yellow
      span.style.color = '#000000';
      span.className = 'my-extension-highlight';
      
      // This command wraps the selected text with our styled span
      range.surroundContents(span);

      // Save the highlight to storage only if visual highlighting succeeds
      saveHighlight(selectedText, window.location.href);

      // Optional: Clear the blue selection box so the yellow stands out
      selection.removeAllRanges();
      
    } catch (error) {
      // surroundContents fails if the selection crosses multiple HTML tags (like <div> to <p>)
      console.error("Highlighting failed: selection crosses complex boundaries.", error);
    }
    });
  }
});

function saveHighlight(text, url) {
  chrome.storage.local.get({ highlights: [] }, (result) => {
    const highlights = result.highlights;
    
    highlights.push({
      text: text,
      url: url,
      date: new Date().toLocaleString()
    });

    chrome.storage.local.set({ highlights: highlights }, () => {
      console.log('Highlight saved!');
    });
  });
}

function restoreHighlights() {
  chrome.storage.local.get({ highlights: [] }, (result) => {
    const highlights = result.highlights;
    if (!highlights) return;

    const currentUrl = window.location.href;
    // Filter highlights that belong to this specific page
    const pageHighlights = highlights.filter(h => h.url === currentUrl);

    pageHighlights.forEach(h => {
      findAndHighlight(h.text);
    });
  });
}

function findAndHighlight(searchText) {
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
      span.style.backgroundColor = '#ffff00';
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
