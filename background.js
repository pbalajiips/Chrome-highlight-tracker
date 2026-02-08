// Handle badge updates from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "updateBadge" && sender.tab) {
    const tabId = sender.tab.id;
    
    chrome.storage.local.get({ isPaused: false, userColor: '#ffff00' }, (data) => {
      if (data.isPaused) {
        chrome.action.setBadgeText({ text: "OFF", tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: "#5f6368", tabId: tabId });
      } else {
        const text = message.count > 0 ? message.count.toString() : "";
        chrome.action.setBadgeText({ text: text, tabId: tabId });
        chrome.action.setBadgeBackgroundColor({ color: data.userColor, tabId: tabId });
      }
    });
  }
});

// Handle global state changes (Pause/Resume or Color Change)
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local') {
    // If pause state changes, update all tabs immediately
    if (changes.isPaused) {
      const isPaused = changes.isPaused.newValue;
      if (isPaused) {
        chrome.action.setBadgeText({ text: "OFF" });
        chrome.action.setBadgeBackgroundColor({ color: "#5f6368" });
      } else {
        chrome.action.setBadgeText({ text: "" }); // Clear global "OFF"
        // Restore color
        chrome.storage.local.get({ userColor: '#ffff00' }, (data) => {
          chrome.action.setBadgeBackgroundColor({ color: data.userColor });
        });
      }
    }

    // If color changes, update badge background
    if (changes.userColor) {
      chrome.storage.local.get({ isPaused: false }, (data) => {
        if (!data.isPaused) {
          chrome.action.setBadgeBackgroundColor({ color: changes.userColor.newValue });
        }
      });
    }
  }
});