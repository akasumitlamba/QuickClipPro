// Initialize storage with default values when the extension is installed
chrome.runtime.onInstalled.addListener(function() {
  chrome.storage.local.get(['counter', 'snippets'], function(result) {
    if (result.counter === undefined) {
      chrome.storage.local.set({ counter: 0 });
    }
    if (result.snippets === undefined) {
      chrome.storage.local.set({ snippets: [] });
    }
  });

  // Allow users to open the sidebar by clicking the action toolbar icon
  chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error("Error setting side panel behavior:", error));
});
