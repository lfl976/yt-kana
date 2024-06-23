let lastUrl = "";

function sendMessageToTab(tabId, message) {
	chrome.tabs.sendMessage(tabId, message, (response) => {
		if (chrome.runtime.lastError) {
			console.log("Error sending message:", chrome.runtime.lastError);
		}
	});
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
	if (changeInfo.status === "complete" && tab.url !== lastUrl) {
		lastUrl = tab.url;
		sendMessageToTab(tabId, {
			action: "urlChanged",
			url: tab.url,
		});
	}
});
