// Recovery mechanism state variables
let deletedSnippets = [];
let preDeletionSnippets = [];
let undoTimeout = null;
let isRecovering = false;
let hasRecovered = false;

document.addEventListener('DOMContentLoaded', function() {
  const snippetText = document.getElementById('snippetText');
  const tagSelectForNewSnippet = document.getElementById('tagSelect');
  const inputCard = document.querySelector('.card');
  const inputControlsRow = document.querySelector('.input-controls-row');
  const settingsBtn = document.getElementById('settingsBtn');
  const settingsModal = document.getElementById('settingsModal');
  const closeSettings = document.getElementById('closeSettings');
  const themeSelect = document.getElementById('themeSelect');
  const exportDataBtn = document.getElementById('exportDataBtn');
  const importDataBtn = document.getElementById('importDataBtn');
  const importFileInput = document.getElementById('importFileInput');
  const imageUpload = document.getElementById('imageUpload');
  const imagePreview = document.getElementById('imagePreview');
  const imagePreviewContainer = document.getElementById('imagePreviewContainer');
  const removeImageBtn = document.getElementById('removeImage');

  // Create the recovery button element
  const recoveryButtonContainer = document.createElement('div');
  recoveryButtonContainer.className = 'recovery-button-container';
  recoveryButtonContainer.innerHTML = `
    <div class="snippets-deleted-text">0 snippets deleted</div>
    <button id="recoverSnippetBtn" class="recover-btn">
      <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M1 4v6h6"></path>
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
      </svg>
      Recover
    </button>
  `;
  
  // Add to document body instead of after filter row
  document.body.appendChild(recoveryButtonContainer);

  let currentImageDataUrl = null; // Store image as data URL
  
  // Image upload handling
  if (imageUpload) {
    imageUpload.addEventListener('change', function(e) {
      const file = e.target.files[0];
      if (file && file.type.match('image.*')) {
        const reader = new FileReader();
        
        reader.onload = function(e) {
          currentImageDataUrl = e.target.result;
          imagePreview.src = currentImageDataUrl;
          imagePreviewContainer.style.display = 'block';
        };
        
        reader.readAsDataURL(file);
      }
    });
  }
  
  // Remove image button
  if (removeImageBtn) {
    removeImageBtn.addEventListener('click', function() {
      currentImageDataUrl = null;
      imagePreview.src = '';
      imagePreviewContainer.style.display = 'none';
      imageUpload.value = '';
    });
  }

  // Tag management functionality
  const addTagBtn = document.getElementById('addTagBtn');
  const tagsList = document.getElementById('tagsList');
  
  console.log("DOM elements initialized:");
  console.log("- addTagBtn:", addTagBtn);
  console.log("- tagsList:", tagsList);
  console.log("- settingsModal:", settingsModal);
  
  // Only initialize tag management if elements are found
  if (tagsList) {
    console.log("Tag management elements found, initializing...");
    
    // Initialize tags when popup opens
    loadTags();
    
    // Add event listener for adding new tag
    if (addTagBtn) {
      addTagBtn.addEventListener('click', addNewTag);
    }
  } else {
    console.error("Tag management elements not found! Make sure the HTML contains the required elements.");
  }

  // Initialize counter and snippets from storage
  chrome.storage.local.get(['counter', 'snippets', 'snippetTextHeight', 'lastSelectedTagForNewSnippet', 'extensionTheme'], function(result) {
    document.getElementById('counter').textContent = result.counter || 0;
    if (result.snippets) {
      displaySnippets(result.snippets);
    }

    // Restore textarea height
    if (result.snippetTextHeight && snippetText) {
      snippetText.style.height = result.snippetTextHeight;
    }
    // Always restore height if possible
    if (snippetText && !snippetText.style.height && result.snippetTextHeight) {
      snippetText.style.height = result.snippetTextHeight;
    }

    // Restore last selected tag for new snippet and apply element colors
    if (result.lastSelectedTagForNewSnippet && tagSelectForNewSnippet) {
      tagSelectForNewSnippet.value = result.lastSelectedTagForNewSnippet;
    }
    // Always apply theming on load
    if (tagSelectForNewSnippet && snippetText && inputCard && inputControlsRow) {
      const selectedTag = tagSelectForNewSnippet.value;
      applyTagStyling(selectedTag);
    }

    // Restore theme on load
    const theme = result.extensionTheme || 'light';
    themeSelect.value = theme;
    applyTheme(theme);
  });

  // Save textarea height on mouseup (after potential resize)
  if (snippetText) {
    snippetText.addEventListener('mouseup', function() {
      chrome.storage.local.set({ snippetTextHeight: this.style.height });
    });
    snippetText.addEventListener('input', function() {
      chrome.storage.local.set({ snippetTextHeight: this.style.height });
    });
    window.addEventListener('beforeunload', function() {
      chrome.storage.local.set({ snippetTextHeight: snippetText.style.height });
    });
    snippetText.addEventListener('blur', function() {
      chrome.storage.local.set({ snippetTextHeight: snippetText.style.height });
    });
  }

  // Counter controls
  document.getElementById('incrementBtn').addEventListener('click', function() {
    updateCounter(1);
  });

  document.getElementById('decrementBtn').addEventListener('click', function() {
    updateCounter(-1);
  });

  // Reset button
  document.getElementById('resetBtn').addEventListener('click', function() {
    chrome.storage.local.set({ counter: 0 }, function() {
      document.getElementById('counter').textContent = '0';
    });
  });

  // Apply tag styling function to keep color application consistent
  function applyTagStyling(selectedTag) {
    const elementsToTheme = [inputCard, snippetText, tagSelectForNewSnippet, inputControlsRow];
    
    // Remove all existing tag classes
    elementsToTheme.forEach(el => {
      if (el) {
        // Remove existing tag classes
        el.classList.forEach(className => {
          if (className.startsWith('bg-')) {
            el.classList.remove(className);
          }
        });
      }
    });
    
    // Apply new tag styling if a tag is selected
        if (selectedTag) {
      chrome.storage.local.get(['customTags'], function(result) {
        const tags = result.customTags || defaultTags;
        const tag = tags.find(t => t.id === selectedTag);
        
        if (tag) {
          const colorId = tag.colorId;
          
          elementsToTheme.forEach(el => {
            if (el) {
              el.classList.add(`bg-${colorId}`);
        }
          });
      }
    });
    }
  }

  // Code for coloring the input card, snippetText, and tagSelectForNewSnippet based on tag selection
  if (tagSelectForNewSnippet) {
    tagSelectForNewSnippet.addEventListener('change', function() {
      const selectedTag = this.value;
      applyTagStyling(selectedTag);
      chrome.storage.local.set({ lastSelectedTagForNewSnippet: selectedTag });
    });
  }

  // Save snippet
  document.getElementById('saveSnippet').addEventListener('click', function() {
    const text = snippetText.value.trim();
    const tag = tagSelectForNewSnippet.value; // This is the currently selected tag
    
    if (text || currentImageDataUrl) {
      savePastedData(text, currentImageDataUrl, tag);
    } else {
      showNotification('Nothing to save. Add text or an image first.', 'warning');
    }
  });

  // Add tag filter event listener (for #tagFilter - the one in the filter row)
  document.getElementById('tagFilter').addEventListener('change', function() {
    applyFilters();
  });

  // Date filter input and search input
  const dateFilterInput = document.getElementById('dateFilter');
  const searchInput = document.getElementById('searchSnippets'); 

  // Add date filter event listener
  dateFilterInput.addEventListener('input', function() {
    applyFilters();
    // Format the date to MM/DD for display (optional, can be kept or removed)
    if (dateFilterInput.value) {
      const date = new Date(dateFilterInput.value);
      if (!isNaN(date)) {
        const mm = String(date.getMonth() + 1).padStart(2, '0');
        const dd = String(date.getDate()).padStart(2, '0');
        dateFilterInput.setAttribute('data-formatted', `${mm}/${dd}`);
        dateFilterInput.blur();
        setTimeout(() => dateFilterInput.blur(), 10);
      }
    } else {
      dateFilterInput.removeAttribute('data-formatted');
    }
  });

  // Add search input event listener
  searchInput.addEventListener('input', function() {
    applyFilters();
  });

  // Set max date to today for dateFilterInput
  if (dateFilterInput) {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    dateFilterInput.max = `${yyyy}-${mm}-${dd}`;
  }

  let calendarOpen = false;
  dateFilterInput.addEventListener('mousedown', function(e) {
    e.preventDefault();
    if (calendarOpen) {
      dateFilterInput.blur();
      calendarOpen = false;
    } else {
      dateFilterInput.showPicker && dateFilterInput.showPicker();
      calendarOpen = true;
    }
  });
  dateFilterInput.addEventListener('blur', function() {
    calendarOpen = false;
  });
  dateFilterInput.addEventListener('keydown', function(e) {
    const allowedKeys = ["Tab", "ArrowLeft", "ArrowRight", "Backspace", "Delete"];
    if (!allowedKeys.includes(e.key)) {
      e.preventDefault();
    }
  });

  // Allow pasting images with keyboard (Ctrl+V) on the text area
  if (snippetText) {
    snippetText.addEventListener('paste', async function(e) {
      // Don't prevent default to allow text pasting to still work normally
      
      // Check if clipboard has an image
      try {
        const clipboardItems = await navigator.clipboard.read();
        
        for (const item of clipboardItems) {
          const imageType = item.types.find(type => type.startsWith('image/'));
          if (imageType) {
            // We found an image, process it
            e.preventDefault(); // Now prevent default since we'll handle it
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            
            reader.onload = function(e) {
              currentImageDataUrl = e.target.result;
              imagePreview.src = currentImageDataUrl;
              imagePreviewContainer.style.display = 'block';
            };
            
            reader.readAsDataURL(blob);
            return; // Exit after processing the first image
          }
        }
      } catch (err) {
        console.error('Error checking clipboard for images:', err);
        // Allow normal paste behavior to continue if there's an error
      }
    });
  }

  // Make the paste and save function more reliable for images
  document.getElementById('pasteSaveSnippet').addEventListener('click', async function() {
    const tag = tagSelectForNewSnippet.value;
    let textToSave = snippetText.value; // Preserve existing text if any
    let imageToSave = currentImageDataUrl;

    try {
      // First try to get image data directly from clipboard items
      const clipboardItems = await navigator.clipboard.read();
      let foundImage = false;

      for (const item of clipboardItems) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          foundImage = true;
          
          // Read as data URL
          const reader = new FileReader();
          reader.onload = function(e) {
            imageToSave = e.target.result;
            currentImageDataUrl = imageToSave;
            imagePreview.src = imageToSave;
            imagePreviewContainer.style.display = 'block';
            
            // Save with image
            savePastedData(textToSave, imageToSave, tag);
          };
          reader.readAsDataURL(blob);
          
          // Return early - we're handling the save in the onload callback
          return;
        }
      }

      // If no image, try to get text if we don't already have it
      if (!foundImage && !textToSave.trim()) {
      const text = await navigator.clipboard.readText();
      if (text.trim()) {
          textToSave = text.trim();
          snippetText.value = textToSave;
        }
      }
      
      // Save if we have either text or image
      if (textToSave.trim() || imageToSave) {
        savePastedData(textToSave.trim(), imageToSave, tag);
      } else {
        showNotification('Nothing found to paste.', 'warning');
      }
    } catch (err) {
      console.error('Advanced clipboard API error:', err);
      
      // Fallback to older clipboard methods - try to get an image via execCommand
      try {
        // Create a temporary textarea for fallback paste
        const tempTextarea = document.createElement('textarea');
        document.body.appendChild(tempTextarea);
        tempTextarea.focus();
        
        const successful = document.execCommand('paste');
        if (successful) {
          // Check if an image was pasted into the textarea (browsers handle this differently)
          const possibleImageData = tempTextarea.value;
          if (possibleImageData && possibleImageData.startsWith('data:image')) {
            imageToSave = possibleImageData;
            currentImageDataUrl = imageToSave;
            imagePreview.src = imageToSave;
            imagePreviewContainer.style.display = 'block';
          } else if (possibleImageData && possibleImageData.trim()) {
            // If we got text, use it
            textToSave = possibleImageData.trim();
            snippetText.value = textToSave;
          }
        }
        
        // Remove the temporary element
        document.body.removeChild(tempTextarea);
        
        // If we have content to save, do it
        if (textToSave.trim() || imageToSave) {
          savePastedData(textToSave.trim(), imageToSave, tag);
        } else {
          showNotification('Clipboard empty or content not supported.', 'warning');
        }
      } catch (fallbackErr) {
        console.error('Fallback clipboard error:', fallbackErr);
        
        // Ultimate fallback - just try to get text
        try {
          const text = await navigator.clipboard.readText();
          if (text.trim()) {
            textToSave = text.trim();
            snippetText.value = textToSave;
            savePastedData(textToSave, imageToSave, tag);
          } else {
            showNotification('Nothing found to paste. Try copying again.', 'warning');
          }
        } catch (finalErr) {
          console.error('Final clipboard error:', finalErr);
          showNotification('Could not access clipboard. Please check permissions.', 'error');
        }
      }
    }
  });

  // Function to save pasted data as a snippet
  function savePastedData(text, image, tag) {
    if (!text && !image) return; // Nothing to save

        chrome.storage.local.get(['snippets'], function(result) {
          const snippets = result.snippets || [];
      const newSnippet = {
        id: Date.now(),
        text: text || '',
        tag: tag,
        timestamp: new Date().toLocaleString(),
        image: image
      };
          snippets.unshift(newSnippet);
          chrome.storage.local.set({ snippets: snippets }, function() {
        if (chrome.runtime.lastError) {
          console.error("Error saving pasted snippet:", chrome.runtime.lastError);
          showNotification('Error saving snippet.', 'error');
          return;
        }
            snippetText.value = '';
        currentImageDataUrl = null;
        imagePreview.src = '';
        imagePreviewContainer.style.display = 'none';
        if (document.getElementById('imageUpload')) document.getElementById('imageUpload').value = '';
            applyFilters();
          });
        });
      }

  // Open settings modal
  settingsBtn.addEventListener('click', function() {
    settingsModal.style.display = 'flex';
  });
  // Close settings modal
  closeSettings.addEventListener('click', function() {
    settingsModal.style.display = 'none';
  });
  // Close modal on overlay click
  settingsModal.addEventListener('click', function(e) {
    if (e.target === settingsModal) settingsModal.style.display = 'none';
  });

  // Theme switching
  function applyTheme(theme) {
    document.body.classList.remove('theme-light', 'theme-dark');
    document.body.classList.add('theme-' + theme);
  }
  themeSelect.addEventListener('change', function() {
    const theme = themeSelect.value;
    applyTheme(theme);
    chrome.storage.local.set({ extensionTheme: theme });
  });

  // --- Settings Toggles ---
  const toggles = [
    { id: 'toggleTimestamp', selector: '.snippet-timestamp', all: true },
    { id: 'toggleDateFilter', selector: '.date-filter-group' },
    { id: 'toggleTagFilter', selector: '.tag-filter-container' },
    { id: 'toggleSearchFilter', selector: '.search-filter-group' },
    { id: 'toggleSnippetTags', selector: '.snippet-top-tag', all: true },
    { id: 'toggleDoubleClickEdit' }
  ];

  function applyToggles(settings) {
    toggles.forEach(t => {
      // Only apply visibility toggles
      if (!t.selector) return;
      
      // For the date filter, we want it hidden by default (if it's not set yet)
      let show = t.id === 'toggleDateFilter' ? 
        settings[t.id] === true : // Only show if explicitly set to true
        settings[t.id] !== false; // Otherwise, show unless explicitly set to false
        
      if (t.all) {
        document.querySelectorAll(t.selector).forEach(el => el.classList.toggle('hidden', !show));
      } else {
        const el = document.querySelector(t.selector);
        if (el) el.classList.toggle('hidden', !show);
      }
    });
    
    // Add logic for input-controls-row layout
    const inputControlsRow = document.querySelector('.input-controls-row');
    if (inputControlsRow) {
      const saveButton = document.querySelector('#saveSnippet');
      const pasteButton = document.querySelector('#pasteSaveSnippet');
      
      // Remove all layout classes first
      inputControlsRow.classList.remove('hide-save', 'hide-paste', 'hide-both');
      
      if (saveButton && saveButton.classList.contains('hidden') &&
          pasteButton && pasteButton.classList.contains('hidden')) {
        inputControlsRow.classList.add('hide-both');
      }
    }
  }

  function saveTogglesToStorage() {
    const settings = {};
    toggles.forEach(t => {
      const element = document.getElementById(t.id);
      if (element) { // Check if the element exists
        settings[t.id] = element.checked;
      }
    });
    chrome.storage.local.set(settings);
    // Only apply visibility toggles visually
    applyToggles(settings);
  }

  toggles.forEach(t => {
    const cb = document.getElementById(t.id);
    if (cb) cb.addEventListener('change', saveTogglesToStorage);
  });

  // Restore toggles from storage
  chrome.storage.local.get(toggles.map(t => t.id), function(settings) {
    toggles.forEach(t => {
      const cb = document.getElementById(t.id);
      if (cb) {
        // Special handling for the date filter, default to unchecked
        if (t.id === 'toggleDateFilter' && settings[t.id] === undefined) {
          cb.checked = false; // Default to unchecked if not set
        } else {
          // Default all toggles to checked if not explicitly set (except date filter)
          cb.checked = settings[t.id] !== false;
        }
      }
    });
    // Apply visual toggles on load
    applyToggles(settings);
  });

  // Counter management functionality
  const addCounterBtn = document.getElementById('addCounterBtn');
  const countersList = document.getElementById('countersList');
  const additionalCountersGrid = document.getElementById('additionalCountersGrid');

  // Initialize main counter in settings
  function initializeMainCounter() {
    chrome.storage.local.get(['mainCounterName'], function(result) {
      const mainCounterName = result.mainCounterName || 'Main Counter';
      const mainCounter = document.createElement('div');
      mainCounter.className = 'counter-item main-counter';
      mainCounter.innerHTML = `
        <div class="counter-info">
          <span class="counter-name">${mainCounterName}</span>
          <div class="counter-actions">
            <button class="edit-counter" data-id="main" title="Edit name">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="toggle-counter" data-id="main" title="Hide counter">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>
      `;
      
      // If countersList exists, append the main counter
      if (countersList) {
        // Clear any existing main counter
        const existingMainCounter = countersList.querySelector('.main-counter');
        if (existingMainCounter) {
          existingMainCounter.remove();
        }
        
        // Add the new main counter at the beginning
        if (countersList.firstChild) {
          countersList.insertBefore(mainCounter, countersList.firstChild);
        } else {
          countersList.appendChild(mainCounter);
        }
        
        // Update toggle button icon based on visibility
        chrome.storage.local.get(['hiddenCounters'], function(result) {
          const hiddenCounters = result.hiddenCounters || [];
          const isMainHidden = hiddenCounters.includes('main');
          const mainToggleBtn = mainCounter.querySelector('.toggle-counter');
          
          if (mainToggleBtn) {
            updateToggleButtonIcon(mainToggleBtn, isMainHidden);
          }
        });
      }
      
      return mainCounter;
    });
    
    // Return a placeholder while the async operation completes
    const placeholder = document.createElement('div');
    placeholder.className = 'counter-item main-counter';
    return placeholder;
  }

  // Load counters
  function loadCounters() {
    chrome.storage.local.get(['additionalCounters', 'mainCounterName', 'hiddenCounters'], function(result) {
      const counters = result.additionalCounters || [];
      const mainCounterName = result.mainCounterName || 'Main Counter';
      const hiddenCounters = result.hiddenCounters || [];
      
      // Update main counter name in settings
      const mainCounterNameEl = document.querySelector('.main-counter .counter-name');
      if (mainCounterNameEl) {
        mainCounterNameEl.textContent = mainCounterName;
      }
      
      // Update main counter name in header
      const counterTitle = document.querySelector('.logo-title b');
      if (counterTitle) {
        counterTitle.textContent = mainCounterName + ':';
      }
      
      // Update main counter visibility
      const mainCounterToggle = document.querySelector('.main-counter .toggle-counter');
      if (mainCounterToggle) {
        mainCounterToggle.classList.toggle('hidden', hiddenCounters.includes('main'));
      }
      
      displayCountersList(counters);
      displayAdditionalCountersGrid(counters, hiddenCounters);
    });
  }

  // Display counters in settings modal
  function displayCountersList(counters) {
    if (!countersList) return;
    
    // Clear the list except for the main counter which will be updated by initializeMainCounter
    const existingItems = countersList.querySelectorAll('.counter-item:not(.main-counter)');
    existingItems.forEach(item => item.remove());
    
    // Initialize or update the main counter
    initializeMainCounter();
    
    // Add additional counters
    counters.forEach(counter => {
      const counterItem = document.createElement('div');
      counterItem.className = 'counter-item';
      counterItem.innerHTML = `
        <div class="counter-info">
          <span class="counter-name">${counter.name}</span>
          <div class="counter-actions">
            <button class="edit-counter" data-id="${counter.id}" title="Edit name">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="delete-counter" data-id="${counter.id}" title="Delete counter">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
              </svg>
            </button>
            <button class="toggle-counter" data-id="${counter.id}" title="Hide counter">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                <circle cx="12" cy="12" r="3"></circle>
              </svg>
            </button>
          </div>
        </div>
      `;
      countersList.appendChild(counterItem);
      
      // Update toggle button icon based on visibility
      chrome.storage.local.get(['hiddenCounters'], function(result) {
        const hiddenCounters = result.hiddenCounters || [];
        const isHidden = hiddenCounters.includes(counter.id);
        const toggleBtn = counterItem.querySelector('.toggle-counter');
        
        if (toggleBtn) {
          updateToggleButtonIcon(toggleBtn, isHidden);
        }
      });
    });
  }

  // Helper function to update toggle button icon
  function updateToggleButtonIcon(button, isHidden) {
    if (isHidden) {
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
          <line x1="1" y1="1" x2="23" y2="23"></line>
        </svg>
      `;
      button.title = "Show counter";
      button.classList.add('hidden');
    } else {
      button.innerHTML = `
        <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
          <circle cx="12" cy="12" r="3"></circle>
        </svg>
      `;
      button.title = "Hide counter";
      button.classList.remove('hidden');
    }
  }

  // Display additional counters in grid
  function displayAdditionalCountersGrid(counters, hiddenCounters) {
    if (!additionalCountersGrid) return;
    
    additionalCountersGrid.innerHTML = '';
    
    // Show/hide main counter and toggle header class
    const mainCounterElement = document.querySelector('.header-title-counter');
    const headerElement = document.querySelector('.header');
    const isMainCounterHidden = hiddenCounters.includes('main');

    if (mainCounterElement) {
      mainCounterElement.style.display = isMainCounterHidden ? 'none' : 'flex';
    }
    if (headerElement) {
      headerElement.classList.toggle('main-counter-hidden', isMainCounterHidden);
    }
    
    // Hide the grid completely if there are no visible counters
    let visibleCounters = 0;
    
    counters.forEach(counter => {
      if (!hiddenCounters.includes(counter.id)) {
        visibleCounters++;
        const miniCounter = document.createElement('div');
        miniCounter.className = 'mini-counter';
        miniCounter.innerHTML = `
          <div class="counter-header">
            <span class="counter-title">${counter.name}</span>
          </div>
          <div class="counter-controls">
            <button class="decrement-mini" data-id="${counter.id}" aria-label="Decrement">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
            <span class="counter-value">${counter.value || 0}</span>
            <button class="increment-mini" data-id="${counter.id}" aria-label="Increment">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            </button>
          </div>
        `;
        additionalCountersGrid.appendChild(miniCounter);
      }
    });

    // Show/hide the grid container based on whether there are visible counters
    additionalCountersGrid.style.display = visibleCounters > 0 ? 'grid' : 'none';

    // Add event listeners for mini counter buttons
    document.querySelectorAll('.decrement-mini').forEach(btn => {
      btn.addEventListener('click', () => updateMiniCounter(btn.dataset.id, -1));
    });
    document.querySelectorAll('.increment-mini').forEach(btn => {
      btn.addEventListener('click', () => updateMiniCounter(btn.dataset.id, 1));
    });
  }

  // Update mini counter value
  function updateMiniCounter(id, change) {
    chrome.storage.local.get(['additionalCounters'], function(result) {
      const counters = result.additionalCounters || [];
      const counterIndex = counters.findIndex(c => c.id === id);
      if (counterIndex !== -1) {
        counters[counterIndex].value = Math.max(0, (counters[counterIndex].value || 0) + change);
        chrome.storage.local.set({ additionalCounters: counters }, function() {
          loadCounters();
        });
      }
    });
  }

  // Add new counter
  if (addCounterBtn) {
    addCounterBtn.addEventListener('click', function() {
      chrome.storage.local.get(['additionalCounters'], function(result) {
        const counters = result.additionalCounters || [];
        if (counters.length >= 6) {
          alert('Maximum number of additional counters (6) reached!');
          return;
        }
        
        const counterName = prompt('Enter a name for the new counter:');
        if (counterName && counterName.trim()) {
          const newCounter = {
            id: Date.now().toString(),
            name: counterName.trim(),
            value: 0
          };
          counters.push(newCounter);
          chrome.storage.local.set({ additionalCounters: counters }, function() {
            loadCounters();
          });
        }
      });
    });
  }

  // Handle counter actions (edit, delete, toggle)
  if (countersList) {
    countersList.addEventListener('click', function(e) {
      const button = e.target.closest('button');
      if (!button) return;
      
      const counterId = button.dataset.id;
      if (!counterId) return;
      
      if (button.classList.contains('edit-counter')) {
        const counterName = prompt('Enter new name for the counter:');
        if (counterName && counterName.trim()) {
          if (counterId === 'main') {
            chrome.storage.local.set({ mainCounterName: counterName.trim() }, function() {
              loadCounters();
            });
          } else {
            chrome.storage.local.get(['additionalCounters'], function(result) {
              const counters = result.additionalCounters || [];
              const counterIndex = counters.findIndex(c => c.id === counterId);
              if (counterIndex !== -1) {
                counters[counterIndex].name = counterName.trim();
                chrome.storage.local.set({ additionalCounters: counters }, function() {
                  loadCounters();
                });
              }
            });
          }
        }
      } else if (button.classList.contains('delete-counter')) {
        chrome.storage.local.get(['additionalCounters'], function(result) {
          const counters = result.additionalCounters || [];
          const updatedCounters = counters.filter(c => c.id !== counterId);
          chrome.storage.local.set({ additionalCounters: updatedCounters }, function() {
            loadCounters();
          });
        });
      } else if (button.classList.contains('toggle-counter')) {
        chrome.storage.local.get(['hiddenCounters'], function(result) {
          const hiddenCounters = result.hiddenCounters || [];
          const isHidden = hiddenCounters.includes(counterId);
          
          if (isHidden) {
            const updatedHidden = hiddenCounters.filter(id => id !== counterId);
            chrome.storage.local.set({ hiddenCounters: updatedHidden }, function() {
              updateToggleButtonIcon(button, false);
              loadCounters();
            });
          } else {
            hiddenCounters.push(counterId);
            chrome.storage.local.set({ hiddenCounters: hiddenCounters }, function() {
              updateToggleButtonIcon(button, true);
              loadCounters();
            });
          }
        });
      }
    });
  }

  // Initialize counters when popup opens
  loadCounters();

  // Color options for tags
  const colorOptions = [
    { id: 'reopened', name: 'Blue', color: '#007BFF', bgColor: '#F0F8FF', darkColor: '#0056B3' },
    { id: 'closed', name: 'Red', color: '#D9534F', bgColor: '#FFF0F0', darkColor: '#C9302C' },
    { id: 'note', name: 'Yellow', color: '#FFC107', bgColor: '#FFF9E6', darkColor: '#D9A400' },
    { id: 'created', name: 'Green', color: '#10b981', bgColor: '#F0FFF4', darkColor: '#0E9F70' },
    { id: 'gray', name: 'Gray', color: '#607D8B', bgColor: '#ECEFF1', darkColor: '#455A64' },
    { id: 'purple', name: 'Purple', color: '#9C27B0', bgColor: '#F5E9FF', darkColor: '#7B1FA2' },
    { id: 'pink', name: 'Pink', color: '#E91E63', bgColor: '#FCE4EC', darkColor: '#C2185B' },
    { id: 'teal', name: 'Teal', color: '#009688', bgColor: '#E0F2F1', darkColor: '#00796B' }
  ];

  // Default tags (8 tags with 4 deactivated by default)
  const defaultTags = [
    { id: 'reopened', name: 'Re-Opened', colorId: 'reopened', active: true },
    { id: 'closed', name: 'Closed', colorId: 'closed', active: true },
    { id: 'note', name: 'Note', colorId: 'note', active: true },
    { id: 'created', name: 'Created', colorId: 'created', active: true },
    { id: 'todo', name: 'TODO', colorId: 'gray', active: false },
    { id: 'flag', name: 'Flag', colorId: 'purple', active: false },
    { id: 'tba', name: 'TBA', colorId: 'pink', active: false },
    { id: 'na', name: 'N/A', colorId: 'teal', active: false }
  ];

  // Load tags
  function loadTags() {
    console.log("Loading tags...");
    chrome.storage.local.get(['customTags'], function(result) {
      console.log("Retrieved tags from storage:", result.customTags);
      let tags = result.customTags;
      
      // If no tags found in storage, initialize with default tags
      if (!tags || tags.length === 0) {
        console.log("No tags found, initializing with defaults");
        tags = defaultTags;
        // Save default tags to storage
        chrome.storage.local.set({ customTags: defaultTags }, function() {
          console.log("Default tags saved to storage");
        });
      } else if (tags.length < 8) {
        // Ensure all 8 default tags exist (for users upgrading from older versions)
        const existingTagIds = tags.map(t => t.id);
        const missingTags = defaultTags.filter(t => !existingTagIds.includes(t.id));
        
        if (missingTags.length > 0) {
          console.log("Adding missing tags:", missingTags);
          tags = [...tags, ...missingTags];
          chrome.storage.local.set({ customTags: tags }, function() {
            console.log("Updated tags saved to storage");
          });
        }
      }
      
      console.log("Tags to display:", tags);
      displayTagsList(tags);
      updateTagSelects(tags.filter(tag => tag.active !== false));
    });
  }

  // Display tags in settings modal
  function displayTagsList(tags) {
    console.log("Displaying tags list:", tags);
    
    if (!tagsList) {
      console.error("Tags list element not found in DOM!");
      return;
    }
    
    console.log("Clearing tags list and adding", tags.length, "tags");
    tagsList.innerHTML = '';
    
    tags.forEach(tag => {
      const colorInfo = colorOptions.find(c => c.id === tag.colorId) || colorOptions[0];
      console.log(`Creating tag item for "${tag.name}" with color ${colorInfo.color}`);
      
      const tagItem = document.createElement('div');
      tagItem.className = 'tag-item';
      tagItem.dataset.id = tag.id;
      tagItem.style.borderLeft = `4px solid ${colorInfo.color}`;
      
      const isActive = tag.active !== false;
      
      tagItem.innerHTML = `
        <div class="tag-info">
          <span class="tag-name">
            ${tag.name}
          </span>
          <div class="tag-actions">
            <button class="edit-tag" data-id="${tag.id}" title="Rename tag">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
              </svg>
            </button>
            <button class="toggle-tag" data-id="${tag.id}" title="${isActive ? 'Deactivate tag' : 'Activate tag'}">
                <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                ${isActive ? 
                  `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>` : 
                  `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`
                }
                </svg>
            </button>
          </div>
        </div>
      `;
      
      tagsList.appendChild(tagItem);
    });
    
    console.log("Finished adding tags to list, adding event listeners");
    
    // Add event listeners for tag actions
    const editButtons = tagsList.querySelectorAll('.edit-tag');
    editButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const tagId = btn.dataset.id;
        editTag(tagId);
      });
    });
    
    // Add throttled event listeners for toggle buttons to prevent rapid clicking
    const toggleButtons = tagsList.querySelectorAll('.toggle-tag');
    toggleButtons.forEach(btn => {
      let isProcessing = false;
      
      btn.addEventListener('click', () => {
        // Prevent multiple rapid clicks
        if (isProcessing) return;
        
        isProcessing = true;
        const tagId = btn.dataset.id;
        
        // Add visual feedback
        btn.classList.add('processing');
        
        // Toggle the tag with a small delay for visual feedback
        setTimeout(() => {
          toggleTag(tagId);
          isProcessing = false;
          btn.classList.remove('processing');
        }, 300);
      });
    });
    
    console.log("Tag list display complete");
  }

  // Update tag selects in the UI
  function updateTagSelects(tags) {
    const tagSelects = [
      document.getElementById('tagSelect'),
      document.getElementById('tagFilter')
    ];
    
    tagSelects.forEach(select => {
      if (!select) return;
      
      // Save current value
      const currentValue = select.value;
      
      // Clear options except "All Tags" for the filter
      if (select.id === 'tagFilter') {
        select.innerHTML = '<option value="all">All Tags</option>';
      } else {
        select.innerHTML = '';
      }
      
      // Add options for each tag
      tags.forEach(tag => {
        const option = document.createElement('option');
        option.value = tag.id;
        option.textContent = tag.name;
        option.className = `tag-option-${tag.colorId}`;
        select.appendChild(option);
      });
      
      // Restore selected value if it still exists
      if (currentValue && Array.from(select.options).some(opt => opt.value === currentValue)) {
        select.value = currentValue;
      } else if (select.options.length > 0) {
        // Set first option as default if previous value is no longer available
        select.value = select.options[0].value;
        if (select.id === 'tagSelect') {
          // Apply styling for the first tag
          applyTagStyling(select.value);
          chrome.storage.local.set({ lastSelectedTagForNewSnippet: select.value });
        }
      }
    });
  }

  // Edit tag name
  function editTag(tagId) {
    chrome.storage.local.get(['customTags', 'snippets'], function(result) {
      const tags = result.customTags || defaultTags;
      const tag = tags.find(t => t.id === tagId);
      
      if (tag) {
        const newName = prompt('Enter new name for the tag:', tag.name);
        if (newName && newName.trim()) {
          tag.name = newName.trim();
          
          chrome.storage.local.set({ 
            customTags: tags
          }, function() {
            loadTags();
            const snippets = result.snippets || [];
            if (snippets.length > 0) {
              displaySnippets(snippets);
            }
          });
        }
      }
    });
  }

  // Toggle tag active state
  function toggleTag(tagId) {
    chrome.storage.local.get(['customTags', 'snippets'], function(result) {
      const tags = result.customTags || defaultTags;
      const tagIndex = tags.findIndex(t => t.id === tagId);
      
      if (tagIndex !== -1) {
        console.log(`Toggling tag "${tags[tagIndex].name}" active state from ${tags[tagIndex].active} to ${!tags[tagIndex].active}`);
        
        // Toggle the active state
        tags[tagIndex].active = !tags[tagIndex].active;
        
        // Check if we're deactivating a tag that's currently in use
        const isDeactivating = !tags[tagIndex].active;
        
        if (isDeactivating) {
          // Check if there's at least one active tag
          const activeTagsCount = tags.filter(t => t.active).length;
          console.log(`Active tags count: ${activeTagsCount}`);
          
          if (activeTagsCount === 0) {
            console.log("Cannot deactivate the last active tag");
            alert('Cannot deactivate the last active tag. At least one tag must remain active.');
            tags[tagIndex].active = true; // Revert the change
            chrome.storage.local.set({ customTags: tags }, function() {
            loadTags();
            });
            return;
          }

          // Check if this tag is currently selected in the dropdown
          const tagSelect = document.getElementById('tagSelect');
          if (tagSelect && tagSelect.value === tagId) {
            // Find first active tag to select instead
            const firstActiveTag = tags.find(t => t.active);
            if (firstActiveTag) {
              tagSelect.value = firstActiveTag.id;
              applyTagStyling(firstActiveTag.id);
              chrome.storage.local.set({ lastSelectedTagForNewSnippet: firstActiveTag.id });
            }
          }
        }
        
        // Save the updated tags
        chrome.storage.local.set({ customTags: tags }, function() {
          console.log("Tags updated in storage, reloading tag UI");
          loadTags();
          
          // Update snippet display if needed
          const snippets = result.snippets || [];
          if (snippets.length > 0) {
            displaySnippets(snippets);
          }
        });
      }
    });
  }

  // Remove addNewTag function as we don't need it anymore
  // Instead, replace the addNewTag event listener with null action

  // Change addTagBtn event listener to show info message
  if (addTagBtn) {
    addTagBtn.style.display = 'none'; // Hide the add button completely
  }

  // Initialize tags when popup opens
  console.log("DOM loaded, initializing tags...");
  loadTags();

  // Export and Import Data functionality
  if (exportDataBtn) {
    exportDataBtn.addEventListener('click', exportData);
  }
  
  if (importDataBtn) {
    importDataBtn.addEventListener('click', function() {
      importFileInput.click();
    });
  }
  
  if (importFileInput) {
    importFileInput.addEventListener('change', importData);
  }

  // Recovery button click handler
  document.addEventListener('click', function(e) {
    if (e.target.closest('#recoverSnippetBtn')) {
      recoverDeletedSnippets();
    }
  });

  // Initialize the recovery button setting
  chrome.storage.local.get(['toggleRecoveryButton'], function(result) {
    // Default to true if not set
    const recoveryEnabled = result.toggleRecoveryButton !== false;
    
    // Add the setting to the settings modal if not already there
    const settingsToggles = document.querySelector('.settings-toggles');
    if (settingsToggles && !document.getElementById('toggleRecoveryButton')) {
      const recoveryToggle = document.createElement('label');
      recoveryToggle.innerHTML = `<input type="checkbox" id="toggleRecoveryButton" ${recoveryEnabled ? 'checked' : ''}> Show Recovery Button for Deleted Snippets`;
      settingsToggles.appendChild(document.createElement('br'));
      settingsToggles.appendChild(recoveryToggle);
      
      // Add event listener for the toggle
      const recoveryToggleCheckbox = document.getElementById('toggleRecoveryButton');
      if (recoveryToggleCheckbox) {
        recoveryToggleCheckbox.addEventListener('change', function() {
          chrome.storage.local.set({ toggleRecoveryButton: this.checked });
          
          // If disabled, hide the recovery button and clear state
          if (!this.checked) {
            hideRecoveryButton();
          }
        });
      }
    }
  });

  // Add an event listener for the recover button directly on the document
  // This ensures it works even if the button is dynamically created
  document.addEventListener('click', function(e) {
    const recoverBtn = e.target.closest('#recoverSnippetBtn');
    if (recoverBtn) {
      console.log("Recover button clicked");
      recoverDeletedSnippets();
    }
  });
});

function applyFilters() {
  const selectedTag = document.getElementById('tagFilter').value;
  const selectedDate = document.getElementById('dateFilter').value;
  const searchTerm = document.getElementById('searchSnippets').value.toLowerCase();

  // Style the tag filter dropdown based on selection
  const tagFilterSelect = document.getElementById('tagFilter');
  
  // Remove all existing tag classes
  tagFilterSelect.classList.forEach(className => {
    if (className.startsWith('bg-')) {
      tagFilterSelect.classList.remove(className);
    }
  });

  if (selectedTag !== 'all') {
    chrome.storage.local.get(['customTags'], function(result) {
      const tags = result.customTags || defaultTags;
      const tag = tags.find(t => t.id === selectedTag);
      
      if (tag) {
        tagFilterSelect.classList.add(`bg-${tag.colorId}`);
      }
    });
  }

  chrome.storage.local.get(['snippets'], function(result) {
    const allSnippets = result.snippets || [];
    let filteredSnippets = allSnippets;

    // Filter by tag
    if (selectedTag !== 'all') {
      filteredSnippets = filteredSnippets.filter(snippet => snippet.tag === selectedTag);
    }

    // Filter by date
    if (selectedDate) {
      filteredSnippets = filteredSnippets.filter(snippet => {
        const snippetDate = new Date(snippet.timestamp).toLocaleDateString('en-CA'); // 'en-CA' gives YYYY-MM-DD
        return snippetDate === selectedDate;
      });
    }

    // Filter by search term (search in snippet.text)
    if (searchTerm) {
      filteredSnippets = filteredSnippets.filter(snippet => 
        snippet.text.toLowerCase().includes(searchTerm)
      );
    }

    displaySnippets(filteredSnippets);
  });
}

function updateCounter(change) {
  chrome.storage.local.get(['counter'], function(result) {
    const newCount = Math.max(0, (result.counter || 0) + change);
    chrome.storage.local.set({ counter: newCount }, function() {
      document.getElementById('counter').textContent = newCount;
    });
  });
}

let clickTimer = null;
const CLICK_DELAY = 250; // milliseconds delay to detect double-click

function displaySnippets(snippets) {
  const snippetsList = document.getElementById('snippetsList');
  snippetsList.innerHTML = ''; // Clear existing snippets
  
  // Remove any existing listeners to prevent duplicates
  snippetsList.removeEventListener('click', handleSnippetClick);
  snippetsList.removeEventListener('dblclick', handleSnippetDoubleClick);
  
  chrome.storage.local.get(['customTags', 'toggleDoubleClickEdit'], function(result) {
    const tags = result.customTags || defaultTags;
    const doubleClickEditEnabled = result.toggleDoubleClickEdit !== false; // Default to true

  snippets.forEach(snippet => {
      const tagObj = tags.find(t => t.id === snippet.tag) || 
                     { id: snippet.tag, name: snippet.tag, colorId: 'note' };
      
    const snippetElement = document.createElement('div');
      snippetElement.className = `snippet-item ${tagObj.colorId}`;
      snippetElement.dataset.snippetId = snippet.id; // Store snippet ID
    
      // Top Tag and Timestamp
    const topTagElement = document.createElement('div');
    topTagElement.className = 'snippet-top-tag';
      topTagElement.textContent = tagObj.name;
    const timestampEl = document.createElement('small');
    timestampEl.classList.add('snippet-timestamp');
      timestampEl.textContent = new Date(snippet.timestamp).toLocaleString();
    topTagElement.appendChild(timestampEl);
      snippetElement.appendChild(topTagElement);
    
      // Content Wrapper
    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'snippet-content-wrapper';

      // Content Area (initially display-only)
    const content = document.createElement('div');
    content.className = 'snippet-content';
      renderSnippetContent(content, snippet); // Use enhanced helper to render content with images
      contentWrapper.appendChild(content);

      // Actions (Copy, Delete)
      const actions = createSnippetActions(snippet);
      contentWrapper.appendChild(actions);

      snippetElement.appendChild(contentWrapper);
      snippetsList.appendChild(snippetElement);
    });

    // Add consolidated event listeners after rendering all snippets
    snippetsList.addEventListener('click', handleSnippetClick);
    if (doubleClickEditEnabled) {
      snippetsList.addEventListener('dblclick', handleSnippetDoubleClick);
    }
  });
}

// Helper function to render snippet content with links and images
function renderSnippetContent(contentElement, snippet) {
  contentElement.innerHTML = ''; // Clear existing content
  
  const contentContainer = document.createElement('div');
  contentContainer.className = snippet.image ? 'snippet-content-with-image' : '';
  
  // Add text content if it exists
  if (snippet.text) {
    const textDiv = document.createElement('div');
    // Replace URLs with clickable links
    const textWithLinks = snippet.text.replace(
      /(https?:\/\/[^\s]+)/g,
    '<a href="$1" target="_blank" rel="noopener noreferrer" class="snippet-link">$1</a>'
    );
    textDiv.innerHTML = textWithLinks;
    contentContainer.appendChild(textDiv);
  }
  
  // Add image if it exists
  if (snippet.image) {
    const imageContainer = document.createElement('div');
    imageContainer.className = 'snippet-image-container';
    imageContainer.title = "Click to open image in new tab";
    
    const img = document.createElement('img');
    img.className = 'snippet-image';
    img.src = snippet.image;
    img.alt = 'Snippet image';
    
    // Add the image first
    imageContainer.appendChild(img);
    
    // Copy image button - Create it as a separate div with absolute positioning
    const copyBtnContainer = document.createElement('div');
    copyBtnContainer.className = 'copy-btn-container';
    copyBtnContainer.style.position = 'absolute';
    copyBtnContainer.style.top = '5px';
    copyBtnContainer.style.right = '5px';
    copyBtnContainer.style.zIndex = '20';
    
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-image-btn';
    copyBtn.title = 'Copy image';
    copyBtn.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
        <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
      </svg>
    `;
    copyBtn.addEventListener('click', (e) => {
      e.stopPropagation(); // Prevent opening the image in a new tab
      copyImageToClipboard(snippet.image, copyBtn);
    });
    
    copyBtnContainer.appendChild(copyBtn);
    imageContainer.appendChild(copyBtnContainer);
    
    // Open image in new tab when clicked
    imageContainer.addEventListener('click', () => {
      const win = window.open('', '_blank');
      win.document.write(`
        <html>
          <head>
            <title>Image</title>
            <style>
              body {
                margin: 0;
                padding: 0;
                display: flex;
                justify-content: center;
                align-items: center;
                min-height: 100vh;
                background-color: #333;
              }
              img {
                max-width: 100%;
                max-height: 100vh;
                object-fit: contain;
              }
            </style>
          </head>
          <body>
            <img src="${snippet.image}" alt="Full size image">
          </body>
        </html>
      `);
    });
    
    contentContainer.appendChild(imageContainer);
  }
  
  contentElement.appendChild(contentContainer);
}

// Helper function to copy image to clipboard
function copyImageToClipboard(dataUrl, buttonElement) {
  // Convert data URL to blob
  const fetchImage = fetch(dataUrl);
  fetchImage.then(res => res.blob())
    .then(blob => {
      const item = new ClipboardItem({ 'image/png': blob });
      navigator.clipboard.write([item])
        .then(() => {
          // Show success indicator
          buttonElement.classList.add('copy-success');
          buttonElement.innerHTML = `
            <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2">
              <polyline points="20 6 9 17 4 12"></polyline>
            </svg>
          `;
          setTimeout(() => {
            buttonElement.classList.remove('copy-success');
            buttonElement.innerHTML = `
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
                <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
              </svg>
            `;
          }, 1500);
        })
        .catch(err => {
          console.error('Could not copy image: ', err);
          alert('Failed to copy image to clipboard.');
        });
    })
    .catch(err => {
      console.error('Error processing image: ', err);
      alert('Failed to process image for copying.');
    });
}

// Helper function to create action buttons
function createSnippetActions(snippet) {
    const actions = document.createElement('div');
    actions.className = 'snippet-actions';

  // Copy button for text only
    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.title = 'Copy text';
    copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
    copyBtn.addEventListener('click', async () => {
      try {
        // Only copy text, regardless of whether an image exists
        await navigator.clipboard.writeText(snippet.text || '');
        showCopySuccess(copyBtn);
      } catch (error) {
        console.error('Copy text error:', error);
        showNotification('Failed to copy text to clipboard.', 'error');
        copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="red" stroke-width="2"><path d="M18 6L6 18M6 6l12 12"/></svg>`;
      setTimeout(() => {
      copyBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
        }, 1500);
      }
    });
    actions.appendChild(copyBtn);

  // Delete button - no confirmation
    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'delete-btn';
    deleteBtn.title = 'Delete';
    deleteBtn.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>`;
  deleteBtn.addEventListener('click', () => {
      // Modified delete functionality with recovery mechanism
      chrome.storage.local.get(['snippets', 'toggleRecoveryButton'], function(result) {
        const snippets = result.snippets || [];
        const recoveryEnabled = result.toggleRecoveryButton !== false; // Default to true
        
        console.log("Delete button clicked for snippet ID:", snippet.id);
        console.log("Recovery enabled:", recoveryEnabled);
        
        // If this is the first deletion in a sequence, take a snapshot
        if (deletedSnippets.length === 0) {
          preDeletionSnippets = [...snippets];
          hasRecovered = false;
          // Clear any existing timeout
          if (undoTimeout) {
            clearTimeout(undoTimeout);
          }
        }
        
        // Add the deleted snippet to deletedSnippets
        const deletedSnippet = snippets.find(s => s.id === snippet.id);
        if (deletedSnippet) {
          deletedSnippets.push(deletedSnippet);
          console.log("Added to deleted snippets, count:", deletedSnippets.length);
        }
        
        // Remove the snippet from the list
        const updatedSnippets = snippets.filter(s => s.id !== snippet.id);
        
        // Update storage
        chrome.storage.local.set({ snippets: updatedSnippets }, function() {
          // Refresh the list
          applyFilters();
          
          // Show recovery button if enabled
          if (recoveryEnabled && deletedSnippets.length > 0) {
            const recoveryButtonContainer = document.querySelector('.recovery-button-container');
            console.log("Recovery button container found:", !!recoveryButtonContainer);
            
            if (recoveryButtonContainer) {
              // Update the count text
              const countText = recoveryButtonContainer.querySelector('.snippets-deleted-text');
              if (countText) {
                countText.textContent = `${deletedSnippets.length} snippet${deletedSnippets.length > 1 ? 's' : ''} deleted`;
              }
              
              // Show the container
              recoveryButtonContainer.classList.add('visible');
              console.log("Added visible class to recovery button");
            } else {
              console.error("Recovery button container not found in DOM");
              
              // Try to create the recovery button container if it doesn't exist
              const newRecoveryContainer = document.createElement('div');
              newRecoveryContainer.className = 'recovery-button-container';
              newRecoveryContainer.innerHTML = `
                <div class="snippets-deleted-text">${deletedSnippets.length} snippet${deletedSnippets.length > 1 ? 's' : ''} deleted</div>
                <button id="recoverSnippetBtn" class="recover-btn">
                  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M1 4v6h6"></path>
                    <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"></path>
                  </svg>
                  Recover
                </button>
              `;
              
              // Add to document body
              document.body.appendChild(newRecoveryContainer);
              
              // Make it visible
              newRecoveryContainer.classList.add('visible');
              console.log("Created and added visible recovery container");
            }
            
            // Set timeout to hide recovery button after 10 seconds
            undoTimeout = setTimeout(hideRecoveryButton, 10000);
          }
        });
      });
    });
    actions.appendChild(deleteBtn);
    
  return actions;
}

// Helper function to display success on copy
function showCopySuccess(button) {
  button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="green" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
  setTimeout(() => {
    button.innerHTML = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>`;
  }, 1500);
}

// Consolidated Click Handler for snippets
function handleSnippetClick(event) {
  clearTimeout(clickTimer); // Clear previous timer

  // Prevent click action if the target is an interactive element inside the snippet
  const interactiveSelectors = 'a.snippet-link, .copy-btn, .delete-btn, .copy-image-btn, .snippet-image-container img';
  if (event.target.closest(interactiveSelectors)) {
    if (event.target.closest('a.snippet-link')) {
      // Handle link click with delay
      event.preventDefault(); 
      const href = event.target.closest('a.snippet-link').href;
    clickTimer = setTimeout(() => {
      window.open(href, '_blank');
    }, CLICK_DELAY);
    }
    // For other interactive elements, their own click listeners will handle actions.
    // We stop propagation to prevent interference with double-click-to-edit.
    event.stopPropagation();
    return;
  }
}

// Consolidated Double-Click Handler for snippets
function handleSnippetDoubleClick(event) {
  clearTimeout(clickTimer); // Prevent single click action (e.g., link opening)
  event.preventDefault(); // Prevent default double-click behavior (like text selection)
  event.stopPropagation(); // Prevent further propagation

  const snippetItem = event.target.closest('.snippet-item');
  if (!snippetItem) return;

  // Do not enter edit mode if double-clicking on an interactive element itself
  const interactiveSelectors = 'a.snippet-link, .copy-btn, .delete-btn, .copy-image-btn, .snippet-actions button, .snippet-image-container img';
  if (event.target.closest(interactiveSelectors)) {
      return;
  }

  const snippetId = parseInt(snippetItem.dataset.snippetId, 10);
  if (isNaN(snippetId)) return;

  chrome.storage.local.get('toggleDoubleClickEdit', function(result) {
    if (result.toggleDoubleClickEdit !== false) { // Default to true
      enterEditMode(snippetItem, snippetId);
    }
  });
}

// Function to switch snippet to edit mode - reordering to put text on top, image on bottom
function enterEditMode(snippetElement, snippetId) {
  // Prevent browser selection (in case preventDefault didn't fully work)
  if (window.getSelection) {
    window.getSelection().removeAllRanges();
  }
  
  const contentWrapper = snippetElement.querySelector('.snippet-content-wrapper');
  const contentDiv = snippetElement.querySelector('.snippet-content');
  const actionsDiv = snippetElement.querySelector('.snippet-actions');
  const timestampDiv = snippetElement.querySelector('.snippet-timestamp'); // Get timestamp div

  if (!contentWrapper || !contentDiv || contentWrapper.querySelector('textarea.snippet-edit-area')) return; // Already in edit mode or elements missing

  // Check if another edit is in progress and save it first
  const existingEditArea = document.querySelector('textarea.snippet-edit-area');
  if (existingEditArea) {
    const existingSnippetItem = existingEditArea.closest('.snippet-item');
    if (existingSnippetItem && existingSnippetItem !== snippetElement) {
       const existingSnippetId = parseInt(existingSnippetItem.dataset.snippetId, 10);
       saveEdit(existingSnippetId, existingEditArea.value);
    }
  }

  chrome.storage.local.get('snippets', function(result) {
    const snippets = result.snippets || [];
    const snippet = snippets.find(s => s.id === snippetId);
    if (!snippet) return;

    // Hide original content, actions, and timestamp
    contentDiv.style.display = 'none';
    if(actionsDiv) actionsDiv.style.display = 'none';
    if(timestampDiv) timestampDiv.style.display = 'none'; // Hide timestamp during edit

    // Create edit container
    const editContainer = document.createElement('div');
    editContainer.className = 'snippet-edit-container';

    // Create textarea for text FIRST (on top)
    const editArea = document.createElement('textarea');
    editArea.className = 'snippet-edit-area';
    editArea.value = snippet.text || '';
    editArea.rows = Math.max(3, ((snippet.text || '').match(/\\n/g) || []).length + 1); // Basic auto-sizing
    
    // Add the textarea before the image (text on top)
    editContainer.appendChild(editArea);

    // Add image preview SECOND (on bottom) if there's an image
    if (snippet.image) {
      const imagePreview = document.createElement('div');
      imagePreview.className = 'image-preview-container edit-mode-image';
      imagePreview.style.marginTop = '10px'; // Add spacing between text and image
      imagePreview.innerHTML = `
        <img src="${snippet.image}" alt="Snippet image">
        <button class="remove-image-btn" title="Remove image">
          <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>
      `;
      
      // Add remove image button functionality
      const removeBtn = imagePreview.querySelector('.remove-image-btn');
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        imagePreview.remove();
        editContainer.dataset.removeImage = 'true';
      });
      
      editContainer.appendChild(imagePreview);
    }

    // Event listener for saving
    const saveHandler = () => {
      if (document.body.contains(editArea)) {
        const shouldRemoveImage = editContainer.dataset.removeImage === 'true';
        saveEdit(snippetId, editArea.value, shouldRemoveImage);
      }
    };

    // Save on Enter (but allow Shift+Enter for newlines)
    editArea.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault(); // Prevent default newline insertion
        saveHandler();
      }
    });

    // Save when clicking outside (blur)
    editArea.addEventListener('blur', () => {
      setTimeout(saveHandler, 100);
    });

    // Add edit container to wrapper
    contentWrapper.appendChild(editContainer);
    editArea.focus();
    // Move cursor to end
    editArea.selectionStart = editArea.selectionEnd = editArea.value.length;
  });
}

// Function to save the edited snippet
function saveEdit(snippetId, newText, removeImage = false) {
  chrome.storage.local.get('snippets', function(result) {
    let snippets = result.snippets || [];
    const snippetIndex = snippets.findIndex(s => s.id === snippetId);
    if (snippetIndex !== -1) {
      const snippet = snippets[snippetIndex];
      
      // Check if anything has changed
      const textChanged = snippet.text !== newText;
      const imageChanged = removeImage && snippet.image;
      
      if (textChanged || imageChanged) {
        snippet.text = newText;
        if (removeImage) {
          snippet.image = null;
        }
        snippet.timestamp = new Date().toLocaleString(); // Update timestamp
        
      chrome.storage.local.set({ snippets: snippets }, function() {
          if (chrome.runtime.lastError) {
            console.error("Error saving snippet:", chrome.runtime.lastError);
          } else {
            applyFilters(); // Refresh the list to show updated snippet and remove textarea
          }
        });
      } else {
        // If nothing has changed, just refresh to exit edit mode
        applyFilters();
      }
    } else {
      console.error("Snippet not found for saving:", snippetId);
      applyFilters(); // Refresh anyway to remove potential stale edit UI
    }
  });
}

// Add these functions at the end of the file, before the closing });
function exportData() {
  // Get all data from storage
  chrome.storage.local.get(null, function(data) {
    // Convert the data to a JSON string
    const jsonData = JSON.stringify(data, null, 2);
    
    // Create a blob with the JSON data
    const blob = new Blob([jsonData], { type: 'application/json' });
    
    // Create a URL for the blob
    const url = URL.createObjectURL(blob);
    
    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    
    // Generate filename with current date and time
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, '-'); // HH-MM-SS
    a.download = `tc-counter-backup-${dateStr}-${timeStr}.json`;
    
    // Append the anchor to the body, click it, and remove it
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    // Release the URL object
    setTimeout(() => URL.revokeObjectURL(url), 100);
    
    // Show success message
    showNotification('Data exported successfully!', 'success');
  });
}

function importData() {
  const fileInput = document.getElementById('importFileInput');
  const file = fileInput.files[0];
  
  if (!file) {
    showNotification('No file selected.', 'error');
    return;
  }
  
  if (file.type !== 'application/json') {
    showNotification('Please select a valid JSON file.', 'error');
    fileInput.value = '';
    return;
  }
  
  const reader = new FileReader();
  
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      
      // Confirm import
      if (confirm('This will replace all your current data. Are you sure you want to continue?')) {
        // Clear existing data and import new data
        chrome.storage.local.clear(function() {
          chrome.storage.local.set(data, function() {
            // Reload the page to reflect the imported data
            showNotification('Data imported successfully! Reloading...', 'success');
            setTimeout(() => window.location.reload(), 1000);
          });
        });
      }
    } catch (error) {
      showNotification('Invalid JSON file. Please try again.', 'error');
      console.error('Import error:', error);
    }
    
    // Reset the file input
    fileInput.value = '';
  };
  
  reader.readAsText(file);
}

// Notification function for feedback
function showNotification(message, type = 'info') {
  // Create notification element
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  
  // Add close button
  const closeBtn = document.createElement('button');
  closeBtn.innerHTML = '&times;';
  closeBtn.className = 'notification-close';
  closeBtn.addEventListener('click', () => {
    document.body.removeChild(notification);
  });
  
  notification.appendChild(closeBtn);
  
  // Add to body
  document.body.appendChild(notification);
  
  // Auto-remove after 3 seconds
  setTimeout(() => {
    if (document.body.contains(notification)) {
      document.body.removeChild(notification);
    }
  }, 3000);
}

// Function to hide the recovery button and clear recovery state
function hideRecoveryButton() {
  const recoveryButtonContainer = document.querySelector('.recovery-button-container');
  if (recoveryButtonContainer) {
    recoveryButtonContainer.classList.remove('visible');
  }
  
  // Clear recovery state
  deletedSnippets = [];
  preDeletionSnippets = [];
  isRecovering = false;
  
  // Clear timeout if exists
  if (undoTimeout) {
    clearTimeout(undoTimeout);
    undoTimeout = null;
  }
}

// Function to recover deleted snippets
function recoverDeletedSnippets() {
  chrome.storage.local.get(['toggleRecoveryButton'], function(result) {
    const recoveryEnabled = result.toggleRecoveryButton !== false;
    
    // Check if recovery is allowed
    if (!recoveryEnabled ||
        deletedSnippets.length === 0 ||
        isRecovering ||
        hasRecovered ||
        preDeletionSnippets.length === 0) {
      return;
    }
    
    // Set the recovering flag to prevent multiple recoveries
    isRecovering = true;
    
    // Clear any existing timeout
    if (undoTimeout) {
      clearTimeout(undoTimeout);
    }
    
    // Restore snippets from pre-deletion snapshot
    chrome.storage.local.set({ snippets: preDeletionSnippets }, function() {
      // Mark as recovered to prevent further recovery
      hasRecovered = true;
      
      // Refresh the list to show recovered snippets
      applyFilters();
      
      // Hide the recovery button
      hideRecoveryButton();
      
      // Show confirmation notification
      showNotification('Snippets recovered successfully', 'success');
    });
  });
}