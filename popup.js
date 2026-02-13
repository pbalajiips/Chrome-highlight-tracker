document.addEventListener('DOMContentLoaded', () => {
  const listElement = document.getElementById('list');
  const clearBtn = document.getElementById('clearBtn');
  const togglePauseBtn = document.getElementById('togglePauseBtn');
  const quickPauseBtn = document.getElementById('quickPauseBtn');
  const colorPicker = document.getElementById('colorPicker');
  const searchInput = document.getElementById('searchInput');
  const siteFilter = document.getElementById('siteFilter');
  
  // Time Management Elements
  const timeRange = document.getElementById('timeRange');
  const customDateInputs = document.getElementById('customDateInputs');
  const dateStart = document.getElementById('dateStart');
  const dateEnd = document.getElementById('dateEnd');
  const applyTimeFilterBtn = document.getElementById('applyTimeFilterBtn');
  const deleteTimeFilterBtn = document.getElementById('deleteTimeFilterBtn');
  const toggleAdvancedBtn = document.getElementById('toggleAdvancedBtn');
  const advancedOptions = document.getElementById('advancedOptions');
  const backupBtn = document.getElementById('backupBtn');
  const restoreInput = document.getElementById('restoreInput');

  let activeTimeFilter = { type: 'all' };

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

  // Toggle Advanced Options
  toggleAdvancedBtn.addEventListener('click', () => {
    if (advancedOptions.style.display === 'block') {
      advancedOptions.style.display = 'none';
      toggleAdvancedBtn.innerHTML = 'Show Advanced Options &#9662;';
    } else {
      advancedOptions.style.display = 'block';
      toggleAdvancedBtn.innerHTML = 'Hide Advanced Options &#9652;';
    }
  });

  // Time Range UI Logic
  timeRange.addEventListener('change', () => {
    const val = timeRange.value;
    if (val === 'range' || val === 'before') {
      customDateInputs.classList.add('visible');
      dateStart.style.display = (val === 'range') ? 'block' : 'none';
    } else {
      customDateInputs.classList.remove('visible');

      // Auto-apply filter for presets (all, last_hour, last_24h, last_week)
      activeTimeFilter = { type: val };
      loadHighlights();
    }
  });

  applyTimeFilterBtn.addEventListener('click', () => {
    activeTimeFilter = {
      type: timeRange.value,
      start: getLocalMidnightTime(dateStart.value),
      end: getLocalMidnightTime(dateEnd.value)
    };
    loadHighlights();
  });

  deleteTimeFilterBtn.addEventListener('click', () => {
    const filterConfig = {
      type: timeRange.value,
      start: getLocalMidnightTime(dateStart.value),
      end: getLocalMidnightTime(dateEnd.value)
    };

    if (filterConfig.type === 'all' && !confirm("This will delete ALL highlights. Are you sure?")) return;
    if (filterConfig.type !== 'all' && !confirm("Delete all highlights matching the selected time range?")) return;

    performTimeBasedDelete(filterConfig);
  });

  backupBtn.addEventListener('click', handleBackup);
  restoreInput.addEventListener('change', handleRestore);

  clearBtn.addEventListener('click', () => {
    if(confirm("Are you sure you want to delete all highlights?")) {
      chrome.storage.local.set({ highlights: [] }, () => {
        loadHighlights();
      });
    }
  });

  if (quickPauseBtn) {
    quickPauseBtn.addEventListener('click', () => {
      chrome.storage.local.get({ isPaused: false }, (result) => {
        const newState = !result.isPaused;
        chrome.storage.local.set({ isPaused: newState }, () => {
          updatePauseButton();
        });
      });
    });
  }

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
        if (quickPauseBtn) {
          quickPauseBtn.textContent = "\u25B6";
          quickPauseBtn.title = "Resume Tracking";
          quickPauseBtn.style.color = "#137333";
        }
      } else {
        togglePauseBtn.textContent = "Pause Tracking";
        togglePauseBtn.classList.remove('resume-mode');
        if (quickPauseBtn) {
          quickPauseBtn.textContent = "\u23F8";
          quickPauseBtn.title = "Pause Tracking";
          quickPauseBtn.style.color = "#5f6368";
        }
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
      const now = Date.now();

      const filteredHighlights = highlights.filter(item => {
        const searchMatch = checkSearchMatch(item, searchText);

        let siteMatch = true;
        if (selectedSite) {
          try {
            siteMatch = new URL(item.url).hostname === selectedSite;
          } catch(e) { siteMatch = false; }
        }

        // Time Filtering
        let timeMatch = true;
        const itemTime = getItemTimestamp(item);
        
        switch (activeTimeFilter.type) {
          case 'last_hour':
            timeMatch = itemTime > (now - 3600000);
            break;
          case 'last_24h':
            timeMatch = itemTime > (now - 86400000);
            break;
          case 'last_week':
            timeMatch = itemTime > (now - 604800000);
            break;
          case 'range':
            if (activeTimeFilter.start && activeTimeFilter.end) {
              // End date should be inclusive of that day (23:59:59)
              const endOfDay = activeTimeFilter.end + 86400000 - 1;
              timeMatch = itemTime >= activeTimeFilter.start && itemTime <= endOfDay;
            }
            break;
          case 'before':
            if (activeTimeFilter.end) {
              timeMatch = itemTime < activeTimeFilter.end;
            }
            break;
        }

        return searchMatch && siteMatch && timeMatch;
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
          <textarea class="note-input" placeholder="Add a note...">${escapeHtml(item.note || '')}</textarea>
          <div class="meta">
            <span>${item.date}</span>
            <a href="${item.url}" target="_blank" title="${item.url}">Source</a>
          </div>
        `;

        // Single click to select
        div.addEventListener('click', (e) => {
          if (e.target.closest('button') || e.target.closest('a') || e.target.closest('textarea')) return;
          
          document.querySelectorAll('.highlight-item').forEach(el => el.classList.remove('selected'));
          div.classList.add('selected');
        });

        // Double click to route to source
        div.addEventListener('dblclick', (e) => {
          if (e.target.closest('button') || e.target.closest('a') || e.target.closest('textarea')) return;
          chrome.tabs.create({ url: item.url });
        });

        // Add delete functionality
        div.querySelector('.delete-btn').addEventListener('click', (e) => {
          e.stopPropagation();
          deleteHighlight(item);
        });

        // Handle Note Saving
        const noteInput = div.querySelector('.note-input');
        noteInput.addEventListener('change', (e) => {
          updateNote(item, e.target.value);
        });
        // Prevent clicks in textarea from triggering row selection
        noteInput.addEventListener('click', (e) => e.stopPropagation());
        noteInput.addEventListener('dblclick', (e) => e.stopPropagation());

        listElement.appendChild(div);
      });
    });
  }

  function updateNote(itemToUpdate, newNote) {
    chrome.storage.local.get({ highlights: [] }, (result) => {
      const highlights = result.highlights;
      // Find the item by matching properties
      const index = highlights.findIndex(h => 
        h.text === itemToUpdate.text && h.url === itemToUpdate.url && h.date === itemToUpdate.date
      );
      
      if (index !== -1) {
        highlights[index].note = newNote;
        chrome.storage.local.set({ highlights: highlights });
      }
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

  function performTimeBasedDelete(filterConfig) {
    chrome.storage.local.get({ highlights: [] }, (result) => {
      const now = Date.now();
      const keptHighlights = result.highlights.filter(item => {
        const itemTime = getItemTimestamp(item);
        let shouldDelete = false;

        switch (filterConfig.type) {
          case 'all': shouldDelete = true; break;
          case 'last_hour': shouldDelete = itemTime > (now - 3600000); break;
          case 'last_24h': shouldDelete = itemTime > (now - 86400000); break;
          case 'last_week': shouldDelete = itemTime > (now - 604800000); break;
          case 'range':
            if (filterConfig.start && filterConfig.end) {
              const endOfDay = filterConfig.end + 86400000 - 1;
              shouldDelete = itemTime >= filterConfig.start && itemTime <= endOfDay;
            }
            break;
          case 'before':
            if (filterConfig.end) {
              shouldDelete = itemTime < filterConfig.end;
            }
            break;
        }
        return !shouldDelete; // Keep items that should NOT be deleted
      });

      chrome.storage.local.set({ highlights: keptHighlights }, () => {
        loadHighlights();
        alert("Deletion complete.");
      });
    });
  }

  function handleBackup() {
    chrome.storage.local.get(null, (data) => {
      if (chrome.runtime.lastError) {
        console.error(chrome.runtime.lastError);
        alert("Error backing up data.");
        return;
      }
      const dataString = JSON.stringify(data, null, 2);
      const blob = new Blob([dataString], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      const date = new Date().toISOString().slice(0, 10);
      a.download = `marknotes-backup-${date}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    });
  }

  function handleRestore(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!confirm("This will overwrite all current highlights and settings. Are you sure you want to restore?")) {
      e.target.value = ''; // Reset file input
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        // Basic validation
        if (typeof data !== 'object' || data === null || !Array.isArray(data.highlights)) {
          throw new Error("Invalid backup file format. Must be a JSON object with a 'highlights' array.");
        }

        chrome.storage.local.clear(() => {
          chrome.storage.local.set(data, () => {
            if (chrome.runtime.lastError) {
              throw new Error(chrome.runtime.lastError.message);
            }
            alert("Restore successful!");
            loadHighlights();
            updatePauseButton();
            loadColor();
          });
        });
      } catch (error) {
        console.error("Error restoring data:", error);
        alert(`Restore failed: ${error.message}`);
      } finally {
        e.target.value = ''; // Reset file input
      }
    };
    reader.onerror = () => {
      alert("Error reading file.");
      e.target.value = '';
    };
    reader.readAsText(file);
  }

  function getLocalMidnightTime(dateString) {
    if (!dateString) return null;
    const parts = dateString.split('-');
    return new Date(parts[0], parts[1] - 1, parts[2]).getTime();
  }

  function getItemTimestamp(item) {
    if (item.timestamp) return item.timestamp;
    // Fallback for old items without timestamp
    const d = new Date(item.date);
    return isNaN(d.getTime()) ? 0 : d.getTime();
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

  function checkSearchMatch(item, query) {
    if (!query || !query.trim()) return true;
    
    // Support "OR" logic (split by ' or ')
    const orGroups = query.split(' or ').filter(s => s.trim().length > 0);
    if (orGroups.length === 0) return false;
    
    return orGroups.some(group => {
      // Support "AND" logic (split by ' and ')
      const andTerms = group.split(' and ').filter(s => s.trim().length > 0);
      if (andTerms.length === 0) return false;
      
      return andTerms.every(term => {
        const cleanTerm = term.trim();
        const textMatch = item.text.toLowerCase().includes(cleanTerm);
        let urlMatch = false;
        try {
          urlMatch = new URL(item.url).hostname.toLowerCase().includes(cleanTerm);
        } catch(e) {}
        return textMatch || urlMatch;
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
