let videoElement;
let captionWindow;
let kanaLine;
let currentSubtitles;
let lastEndTime = 0;

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
	kanaLine.className = "yt-kana-line";
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
	try {
		const response = await fetch(
			`https://yt-kana-api.vercel.app/translate_subtitles?video_id=${videoId}`
		);
		const data = await response.json();
		if (data?.length) {
			currentSubtitles = data;
			console.log("currentSubtitles ===", currentSubtitles);
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
	console.log("currentTime ===", currentTime);
	if (currentTime < lastEndTime) {
		return;
	}
	const currentSubtitle = currentSubtitles.find((subtitle) => {
		return (
			currentTime >= subtitle.start &&
			currentTime <= subtitle.start + subtitle.duration
		);
	});
	console.log("currentSubtitle ===", currentSubtitle);
	if (currentSubtitle) {
		lastEndTime = currentSubtitle.start + currentSubtitle.duration;
		kanaLine.innerHTML = convertToRuby(currentSubtitle.token);
	}
}

const handleTimeUpdate = throttle(updateCaptions, 1000);
function handleVideoEnded() {
	kanaLine.innerHTML = "";
	kanaLine.classList.add("yt-kana-hide");
	lastEndTime = 0;
	removeListener();
}

function setupSubtitle() {
	createSubtitleContainer();
	kanaLine.classList.remove("yt-kana-hide");
	videoElement.addEventListener("timeupdate", handleTimeUpdate);
	videoElement.addEventListener("ended", handleVideoEnded);
}

function removeListener() {
	console.log("removeListener ===");
	videoElement?.removeEventListener("timeupdate", handleTimeUpdate);
	videoElement?.removeEventListener("ended", handleVideoEnded);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	console.log("message ===", message);
	if (message.action === "urlChanged") {
		console.log("URL changed to:", message.url);
		videoElement = document.querySelector("video");
		if (!videoElement) {
			console.error("No video element found.");
			return;
		}
		removeListener();

		const videoId = getVideoId(message.url);
		if (videoId) {
			fetchTranslatedSubtitles(videoId);
		}
	}
	sendResponse({ received: true });
	return true;
});
