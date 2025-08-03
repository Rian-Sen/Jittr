// Background script for Dryft extension
chrome.runtime.onInstalled.addListener(() => {
  console.log('Dryft extension installed');
});

// Handle downloads
chrome.downloads.onChanged.addListener((downloadDelta) => {
  if (downloadDelta.state && downloadDelta.state.current === 'complete') {
    console.log('Download completed:', downloadDelta.id);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'download_files') {
    const { jsonData, csvData, timestamp } = message;
    
    // Download JSON file
    const jsonBlob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    const jsonUrl = URL.createObjectURL(jsonBlob);
    
    chrome.downloads.download({
      url: jsonUrl,
      filename: `drift_mouse_data_${timestamp}.json`,
      saveAs: false
    }, (downloadId) => {
      URL.revokeObjectURL(jsonUrl);
      console.log('JSON file download started:', downloadId);
    });
    
    // Download CSV file
    if (csvData) {
      const csvBlob = new Blob([csvData], { type: 'text/csv' });
      const csvUrl = URL.createObjectURL(csvBlob);
      
      chrome.downloads.download({
        url: csvUrl,
        filename: `drift_mouse_data_${timestamp}.csv`,
        saveAs: false
      }, (downloadId) => {
        URL.revokeObjectURL(csvUrl);
        console.log('CSV file download started:', downloadId);
      });
    }
    
    sendResponse({ success: true });
  }
  
  // Handle ADHD prediction requests
  if (message.type === 'PREDICT_ADHD') {
    const features = message.features;
    console.log('Received features for prediction:', features);
    
    // Call the FastAPI model server
    fetch('http://127.0.0.1:8000/predict', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(features)
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(data => {
      console.log('Model prediction received:', data);
      sendResponse({ 
        success: true, 
        prediction: data.adhd_probability,
        message: `ADHD Probability: ${(data.adhd_probability * 100).toFixed(1)}%`
      });
    })
    .catch(error => {
      console.error('Error calling model server:', error);
      sendResponse({ 
        success: false, 
        error: error.message,
        message: 'Failed to get prediction. Make sure the model server is running on http://127.0.0.1:8000'
      });
    });
    
    // Return true to indicate we'll send a response asynchronously
    return true;
  }
});
