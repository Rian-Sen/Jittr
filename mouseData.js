// Dryft Mouse Tracking Extension - Data Storage
// This file serves as a data storage module for mouse tracking sessions

const mouseDataStorage = {
  // Store session data
  storeSession: function(sessionData) {
    if (typeof window !== 'undefined') {
      // Browser environment - use localStorage
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const key = `dryft_session_${timestamp}`;
      localStorage.setItem(key, JSON.stringify(sessionData));
      console.log(`Session data stored with key: ${key}`);
      return key;
    } else {
      // Node.js environment - could write to file
      console.log('Session data:', JSON.stringify(sessionData, null, 2));
      return 'session_data_logged';
    }
  },

  // Retrieve session data
  getSession: function(sessionKey) {
    if (typeof window !== 'undefined') {
      const data = localStorage.getItem(sessionKey);
      return data ? JSON.parse(data) : null;
    }
    return null;
  },

  // Get all stored sessions
  getAllSessions: function() {
    if (typeof window !== 'undefined') {
      const sessions = {};
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dryft_session_')) {
          sessions[key] = JSON.parse(localStorage.getItem(key));
        }
      }
      return sessions;
    }
    return {};
  },

  // Clear all session data
  clearAllSessions: function() {
    if (typeof window !== 'undefined') {
      const keysToRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('dryft_session_')) {
          keysToRemove.push(key);
        }
      }
      keysToRemove.forEach(key => localStorage.removeItem(key));
      console.log(`Cleared ${keysToRemove.length} session(s)`);
    }
  }
};

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = mouseDataStorage;
} else if (typeof window !== 'undefined') {
  window.mouseDataStorage = mouseDataStorage;
} 