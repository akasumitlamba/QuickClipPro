// Initialize storage with default values when the extension is installed
chrome.runtime.onInstalled.addListener(function(details) {
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

  // Open onboarding page only on first install (not on updates).
  if (details && details.reason === 'install') {
    chrome.tabs.create({
      url: 'https://akasumitlamba.github.io/QuickClipPro/'
    });
  }
});
