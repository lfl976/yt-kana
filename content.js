let videoElement;
let captionWindow;
let kanaLine;
let currentSubtitles;
let lastEndTime = 0;
let url;
let observer;

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getCachedSubtitles(videoId) {
	const data = await chrome.storage.local.get(["cacheData"]);
	return data?.cacheData?.[videoId];
}

function addData(newKey, newData) {
	chrome.storage.local.get(["cacheData"], function (result) {
		let cacheData = result.cacheData || {};

		// 如果已经存储了5条数据，删除最旧的一条
		if (Object.keys(cacheData).length >= 5) {
			let oldestKey = null;
			let oldestTime = Infinity;

			for (let key in cacheData) {
				if (cacheData[key].time < oldestTime) {
					oldestTime = cacheData[key].time;
					oldestKey = key;
				}
			}

			if (oldestKey) {
				delete cacheData[oldestKey]; // 删除最旧的一条数据
			}
		}

		// 添加新数据
		cacheData[newKey] = newData;

		// 保存更新后的数据
		chrome.storage.local.set({ cacheData: cacheData }, function () {});
	});
}

// 示例：添加一条新数据
// addData('xx' + Date.now(), { time: Date.now(), value: 'new data' });

function hasChineseCharacter(text) {
	return /[\u4e00-\u9fff]/.test(text);
}

function convertToRuby(data) {
	let result = "";
	data.forEach((item) => {
		if (item.kana && hasChineseCharacter(item.surface)) {
			result += `<ruby>${item.surface}<rp>(</rp><rt>${item.kana}</rt><rp>)</rp></ruby>`;
		} else {
			result += item.surface;
		}
	});
	return result;
}

function throttle(fn, wait) {
	let lastTime = 0;
	return function (...args) {
		const now = new Date().getTime();
		if (now - lastTime >= wait) {
			lastTime = now;
			fn.apply(this, args);
		}
	};
}

function getVideoId(url) {
	const urlParams = new URLSearchParams(new URL(url).search);
	return urlParams.get("v");
}

function createSubtitleContainer() {
	if (captionWindow) return;
	captionWindow = document.createElement("div");
	captionWindow.id = "yt-kana-caption-window";

	const captionContainer = document.createElement("div");
	captionContainer.className = "yt-kana-caption-container";

	const innerCaptionWindow = document.createElement("div");
	innerCaptionWindow.className = "yt-kana-inner-caption-window";

	const captionsText = document.createElement("div");
	captionsText.className = "yt-captions-text";

	kanaLine = document.createElement("div");
	kanaLine.className = "yt-kana-line yt-kana-hide";
	kanaLine.innerHTML = "";

	captionsText.appendChild(kanaLine);
	innerCaptionWindow.appendChild(captionsText);
	captionContainer.appendChild(innerCaptionWindow);
	captionWindow.appendChild(captionContainer);

	const style = document.createElement("style");
	style.id = "yt-kana-caption-style";
	style.textContent = `
    #yt-kana-caption-window {
        position: absolute;
        width: 100%;
        top: 0;
        bottom: 60px;
        left: 0;
        transition: bottom 0.25s;
        pointer-events: none;
    }
    .yt-kana-caption-container {
				z-index: 41;
        pointer-events: none;
        position: absolute;
        left: 0;
        right: 0;
        bottom: 0;
        top: 0;
    }
    .yt-kana-inner-caption-window {
        pointer-events: auto;
        position: absolute;
        width: 90%;
        left: 5%;
        bottom: 0;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: flex-end;
    }
    .yt-kana-line {
        color: rgb(255, 255, 255);
        background-color: rgba(8, 8, 8, 0.75);
        padding: 12px 12px 0;
        font-weight: 400;
        font-size: 24px;
    }
    .yt-captions-text {
        flex-direction: column;
        display: flex;
        color: white;
        border-radius: 6px;
        text-align: center;
        white-space: pre-wrap;
        line-height: 1.5;
        align-items: center;
    }
		.yt-kana-hide {display: none;}
		.caption-window {display: none;}
`;

	document.head.appendChild(style);
	document.querySelector(".html5-video-player")?.appendChild(captionWindow);
}

async function fetchTranslatedSubtitles(videoId) {
	const cachedData = await getCachedSubtitles(videoId);
	if (cachedData) {
		currentSubtitles = cachedData.value;
		setupSubtitle();
		return;
	}
	try {
		const response = await fetch(
			`https://yt-kana-api.vercel.app/translate_subtitles?video_id=${videoId}`
		);
		const data = await response.json();
		if (data?.length) {
			currentSubtitles = data;
			addData(videoId, { time: Date.now(), value: data });
			setupSubtitle();
		}
	} catch (error) {
		console.error("Error fetching translated subtitles:", error);
	}
}

function updateCaptions() {
	if (
		!currentSubtitles ||
		!currentSubtitles.length ||
		!videoElement ||
		!kanaLine
	) {
		return;
	}
	const currentTime = videoElement.currentTime;
	// if (currentTime < lastEndTime) {
	// 	return;
	// }
	const currentSubtitle = currentSubtitles.find((subtitle) => {
		return (
			currentTime >= subtitle.start &&
			currentTime <= subtitle.start + subtitle.duration
		);
	});
	if (currentSubtitle) {
		kanaLine.classList.remove("yt-kana-hide");
		lastEndTime = currentSubtitle.start + currentSubtitle.duration;
		kanaLine.innerHTML = convertToRuby(currentSubtitle.token);
	}
}

const handleTimeUpdate = throttle(updateCaptions, 1000);
function handleVideoEnded() {
	reset();
}

function reset() {
	if (kanaLine) {
		kanaLine.innerHTML = "";
		kanaLine.classList.add("yt-kana-hide");
	}
	lastEndTime = 0;
	removeListener();
	currentSubtitles = null;
}

function removeSubtitleContainer() {
	const style = document.getElementById("yt-kana-caption-style");
	const theWindow = document.getElementById("yt-kana-caption-window");
	reset();
	if (theWindow) {
		theWindow.remove();
		captionWindow = null;
	}
	if (style) {
		style.remove();
	}
}

function setupSubtitle() {
	createSubtitleContainer();
	videoElement.addEventListener("timeupdate", handleTimeUpdate);
	videoElement.addEventListener("ended", handleVideoEnded);
}

function removeListener() {
	videoElement?.removeEventListener("timeupdate", handleTimeUpdate);
	videoElement?.removeEventListener("ended", handleVideoEnded);
}

function init() {
	videoElement = document.querySelector("video");
	if (!videoElement) {
		console.error("No video element found.");
		return;
	}
	reset();
	const videoId = getVideoId(location.href);
	if (videoId) {
		fetchTranslatedSubtitles(videoId);
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "off") {
		removeSubtitleContainer();
		if (observer) {
			observer.disconnect();
		}
	}
	if (message.action === "on") {
		if (currentSubtitles) {
			setupSubtitle();
		} else {
			init();
			start();
		}
	}
	sendResponse({ received: true });
	return true;
});

function callback(mutationList, observer) {
	init();
}

chrome.storage.local.get("toggle", function (result) {
	if (result.toggle === "on") {
		init();
		start();
	}
});

async function start() {
	// wait for element to be loaded
	await sleep(3000);
	const targetNode = document.querySelector(
		"h1.ytd-watch-metadata yt-formatted-string"
	);

	const observerOptions = {
		childList: true,
		attributes: false,
		subtree: true,
	};

	if (!observer) {
		observer = new MutationObserver(callback);
	}
	observer.observe(targetNode, observerOptions);
}
