document.addEventListener('DOMContentLoaded', () => {
  const listElement = document.getElementById('list');
  const clearBtn = document.getElementById('clearBtn');
  const togglePauseBtn = document.getElementById('togglePauseBtn');

  loadHighlights();
  updatePauseButton();

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

  function loadHighlights() {
    chrome.storage.local.get({ highlights: [] }, (result) => {
      const highlights = result.highlights;
      listElement.innerHTML = '';

      if (highlights.length === 0) {
        listElement.innerHTML = '<p style="text-align:center; color:#777;">No highlights yet.<br>Select text on any page!</p>';
        return;
      }

      // Show newest first
      highlights.reverse().forEach(item => {
        const div = document.createElement('div');
        div.className = 'highlight-item';

        let shortUrl = item.url;
        try {
          const urlObj = new URL(item.url);
          shortUrl = urlObj.hostname + (urlObj.pathname.length > 15 ? urlObj.pathname.substring(0, 15) + '...' : urlObj.pathname);
        } catch(e) {}

        div.innerHTML = `
          <div class="text-content">"${escapeHtml(item.text)}"</div>
          <div class="meta">
            <span>${item.date}</span>
            <a href="${item.url}" target="_blank" title="${item.url}">Source</a>
          </div>
        `;
        listElement.appendChild(div);
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
