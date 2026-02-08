document.addEventListener('DOMContentLoaded', () => {
  const listElement = document.getElementById('list');
  const clearBtn = document.getElementById('clearBtn');
  const togglePauseBtn = document.getElementById('togglePauseBtn');
  const colorPicker = document.getElementById('colorPicker');
  const searchInput = document.getElementById('searchInput');
  const siteFilter = document.getElementById('siteFilter');

  loadHighlights();
  updatePauseButton();
  loadColor();

  // Save color preference when changed
  colorPicker.addEventListener('change', (e) => {
    chrome.storage.local.set({ userColor: e.target.value });
  });

  // Filter list when search or dropdown changes
  searchInput.addEventListener('input', loadHighlights);
  siteFilter.addEventListener('change', loadHighlights);

  clearBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to delete all highlights?")) {
      chrome.storage.local.set({ highlights: [] }, () => {
        loadHighlights();
      });
    }
  });

  togglePauseBtn.addEventListener('click', () => {
    chrome.storage.local.get({ isPaused: false }, (result) => {
      const newState = !result.isPaused;
      chrome.storage.local.set({ isPaused: newState }, () => {
        updatePauseButton();
      });
    });
  });

  function updatePauseButton() {
    chrome.storage.local.get({ isPaused: false }, (result) => {
      if (result.isPaused) {
        togglePauseBtn.textContent = "Resume Tracking";
        togglePauseBtn.classList.add('resume-mode');
      } else {
        togglePauseBtn.textContent = "Pause Tracking";
        togglePauseBtn.classList.remove('resume-mode');
      }
    });
  }

  function loadColor() {
    chrome.storage.local.get({ userColor: '#ffff00' }, (result) => {
      colorPicker.value = result.userColor;
    });
  }

  function loadHighlights() {
    chrome.storage.local.get({ highlights: [] }, (result) => {
      const highlights = result.highlights;
      listElement.innerHTML = '';
      
      // 1. Populate Site Filter Dropdown (only if needed to avoid resetting selection)
      updateSiteFilterOptions(highlights);

      // 2. Filter Data based on inputs
      const searchText = searchInput.value.toLowerCase();
      const selectedSite = siteFilter.value;

      const filteredHighlights = highlights.filter(item => {
        const textMatch = item.text.toLowerCase().includes(searchText);
        let urlMatch = false;
        try {
          urlMatch = new URL(item.url).hostname.toLowerCase().includes(searchText);
        } catch(e) {}

        let siteMatch = true;
        if (selectedSite) {
          try {
            siteMatch = new URL(item.url).hostname === selectedSite;
          } catch(e) { siteMatch = false; }
        }
        return (textMatch || urlMatch) && siteMatch;
      });

      if (filteredHighlights.length === 0) {
        listElement.innerHTML = '<p style="text-align:center; color:#777;">No matching highlights found.</p>';
        return;
      }

      // Show newest first
      filteredHighlights.reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'highlight-item';
        // Use the saved color for the border indicator
        div.style.borderLeftColor = item.color || '#ffff00';

        let shortUrl = item.url;
        try {
          const urlObj = new URL(item.url);
          shortUrl = urlObj.hostname + (urlObj.pathname.length > 15 ? urlObj.pathname.substring(0, 15) + '...' : urlObj.pathname);
        } catch(e) {}

        div.innerHTML = `
          <button class="delete-btn" title="Delete this highlight">&times;</button>
          <div class="text-content">"${escapeHtml(item.text)}"</div>
          <div class="meta">
            <span>${item.date}</span>
            <a href="${item.url}" target="_blank" title="${item.url}">Source</a>
          </div>
        `;

        // Add delete functionality
        div.querySelector('.delete-btn').addEventListener('click', () => {
          deleteHighlight(item);
        });

        listElement.appendChild(div);
      });
    });
  }

  function updateSiteFilterOptions(highlights) {
    // Get all unique hostnames
    const sites = new Set();
    highlights.forEach(h => {
      try { sites.add(new URL(h.url).hostname); } catch(e) {}
    });

    // If the number of options hasn't changed (approx check), skip rebuilding to prevent UI flicker
    // But strictly, we should rebuild to ensure correctness. We just need to preserve selection.
    const currentSelection = siteFilter.value;
    
    // Clear existing options except the first "All Sites"
    while (siteFilter.options.length > 1) {
      siteFilter.remove(1);
    }

    Array.from(sites).sort().forEach(site => {
      const option = document.createElement('option');
      option.value = site;
      option.textContent = site;
      if (site === currentSelection) option.selected = true;
      siteFilter.appendChild(option);
    });
  }

  function deleteHighlight(itemToDelete) {
    chrome.storage.local.get({ highlights: [] }, (result) => {
      // Filter out the item that matches text, url, and date
      const newHighlights = result.highlights.filter(h => 
        !(h.text === itemToDelete.text && h.url === itemToDelete.url && h.date === itemToDelete.date)
      );
      chrome.storage.local.set({ highlights: newHighlights }, () => {
        loadHighlights(); // Reload the list
      });
    });
  }

  // Basic security: prevent XSS by escaping HTML
  function escapeHtml(text) {
    if (!text) return text;
    return text
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
  }
});
