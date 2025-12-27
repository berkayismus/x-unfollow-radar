// Background service worker for message handling
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'TEST_COMPLETE') {
        // Relay test completion to popup
        chrome.runtime.sendMessage(message);
    } else if (message.type === 'STATUS_UPDATE') {
        // Relay status updates to popup
        chrome.runtime.sendMessage(message);
    } else if (message.type === 'RATE_LIMIT_HIT') {
        // Relay rate limit warning to popup
        chrome.runtime.sendMessage(message);
    }
    return true;
});
