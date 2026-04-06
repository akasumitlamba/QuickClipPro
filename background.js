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

  // Open website on first install.
  if (details && details.reason === 'install') {
    chrome.tabs.create({
      url: 'https://akasumitlamba.github.io/QuickClipPro/'
    });
  }

  // On update, only open the website if the version actually changed
  // (reloading an unpacked extension also fires 'update', so we compare versions)
  if (details && details.reason === 'update') {
    const currentVersion = chrome.runtime.getManifest().version;
    chrome.storage.local.get(['_lastKnownVersion'], function(result) {
      if (result._lastKnownVersion !== currentVersion) {
        chrome.storage.local.set({ _lastKnownVersion: currentVersion });
        chrome.tabs.create({
          url: 'https://akasumitlamba.github.io/QuickClipPro/'
        });
      }
    });
  }

  // Store version on first install too
  if (details && details.reason === 'install') {
    const currentVersion = chrome.runtime.getManifest().version;
    chrome.storage.local.set({ _lastKnownVersion: currentVersion });
  }
});
