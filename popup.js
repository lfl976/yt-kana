document.addEventListener("DOMContentLoaded", function () {
	console.log("Popup script loaded.");
});

chrome.storage.local.get("toggle", function (result) {
	if (result.toggle === "off") {
		document.getElementById("toggle").checked = false;
	}
});

document.getElementById("toggle").addEventListener("click", function (e) {
	const action = e.target.checked ? "on" : "off";

	chrome.tabs.query({ currentWindow: true }, function (tabs) {
		for (let i = 0; i < tabs.length; i++) {
			let tab = tabs[i];
			if (tab.url && tab.url.includes("https://www.youtube.com/watch")) {
				chrome.tabs.update(tab.id, { active: true });
				chrome.tabs.sendMessage(tab.id, { action }, (response) => {
					chrome.storage.local.set({ toggle: action }, function () {});

					if (chrome.runtime.lastError) {
						// console.log("Error sending message:", chrome.runtime.lastError);
					}
				});
			}
		}
	});
});
