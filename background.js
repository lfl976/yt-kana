// Description: 后台脚本，用于监听标签页的更新事件，并向标签页发送消息
let lastUrl = "";

function sendMessageToTab(tabId, message) {
	chrome.tabs.sendMessage(tabId, message, (response) => {
		if (chrome.runtime.lastError) {
			console.log("Error sending message:", chrome.runtime.lastError);
			// 如果发送失败，可以在这里添加重试逻辑
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
