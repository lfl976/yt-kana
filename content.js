let lastVideoElement = null;
let throttleTimeout = null;
let lastEndTime = 0;

let captionWindow;
let captionContainer;
let innerCaptionWindow;
let captionsText;
let kanaLine;

let handleTimeUpdate;
let videoElement;

function hasChineseCharacter(text) {
	// 使用正则表达式检查文本中是否包含汉字
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

function getVideoId(url) {
	const urlParams = new URLSearchParams(new URL(url).search);
	return urlParams.get("v");
}

function fetchTranslatedSubtitles(videoId) {
	fetch(
		`https://yt-kana-api.vercel.app/translate_subtitles?video_id=${videoId}`
	)
		.then((response) => response.json())
		.then((data) => {
			// console.log(data);
			if (data?.length) {
				setupSubtitleReplacement(data);
			}
		})
		.catch((error) =>
			console.error("Error fetching translated subtitles:", error)
		);
}

function setupSubtitleReplacement(translatedSubtitles) {
	videoElement = document.querySelector("video");
	if (!videoElement) {
		console.error("No video element found.");
		return;
	}

	const subtitleContainer = document.querySelector(
		".ytp-caption-window-container"
	);
	if (!subtitleContainer) {
		console.error("No subtitle container found.");
		return;
	}

	if (!document.getElementById("yt-kana-caption-window")) {
		const style = document.createElement("style");

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
		.caption-window {display: none;}
`;

		document.head.appendChild(style);

		captionWindow = document.createElement("div");
		captionWindow.id = "yt-kana-caption-window";

		captionContainer = document.createElement("div");
		captionContainer.className = "yt-kana-caption-container";

		innerCaptionWindow = document.createElement("div");
		innerCaptionWindow.className = "yt-kana-inner-caption-window";

		captionsText = document.createElement("div");
		captionsText.className = "yt-captions-text";

		kanaLine = document.createElement("div");
		kanaLine.className = "yt-kana-line";
		kanaLine.innerHTML = "";

		captionsText.appendChild(kanaLine);
		innerCaptionWindow.appendChild(captionsText);
		captionContainer.appendChild(innerCaptionWindow);
		captionWindow.appendChild(captionContainer);

		document.querySelector(".html5-video-player")?.appendChild(captionWindow);
	}

	const showSubtitle = () => {
		const currentTime = videoElement.currentTime;
		if (currentTime < lastEndTime) return;
		translatedSubtitles.forEach((subtitle) => {
			if (
				currentTime >= lastEndTime &&
				currentTime >= subtitle.start &&
				currentTime <= subtitle.start + subtitle.duration
			) {
				lastEndTime = subtitle.start + subtitle.duration;
				kanaLine.innerHTML = convertToRuby(subtitle.token);
			}
		});
	};

	// Throttle the timeupdate event to reduce the frequency of calls
	handleTimeUpdate = function () {
		if (!throttleTimeout) {
			throttleTimeout = setTimeout(() => {
				throttleTimeout = null;
				showSubtitle();
			}, 400);
		}
	};

	// Remove previous event listener if it exists
	removeSubtitleReplacement();

	// Event listener for updating subtitles based on the video's current time
	videoElement.addEventListener("timeupdate", handleTimeUpdate);
	videoElement.addEventListener("ended", handleVideoEnded);
	lastVideoElement = videoElement;
}

// Handle video ended event
function handleVideoEnded() {
	// console.log("Video has ended");
	removeSubtitleReplacement();
	init();
}

function removeSubtitleReplacement() {
	if (lastVideoElement) {
		lastVideoElement.removeEventListener("timeupdate", handleTimeUpdate);
		lastVideoElement.removeEventListener("ended", handleVideoEnded);
	}
}

function init() {
	lastEndTime = 0;
	// Remove the subtitles when the video ends
	const kanaLine = document.querySelector(".yt-kana-line");
	if (kanaLine) {
		kanaLine.innerHTML = "";
	}
	if (throttleTimeout) {
		clearTimeout(throttleTimeout);
		throttleTimeout = null;
	}
}

function initialize() {
	const videoId = getVideoId(window.location.href);
	if (videoId) {
		// console.log("Video ID:", videoId);
		fetchTranslatedSubtitles(videoId);
	}
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	if (message.action === "urlChanged") {
		// console.log("URL changed to:", message.url);
		removeSubtitleReplacement();
		init();
		initialize();
	}
	sendResponse({ received: true });
	// async response
	return true;
});
