// 小红书视频链接提取 - Background Service Worker（极简版）
// 只做 webRequest 监听拦截视频 URL + declarativeNetRequest 注入 Referer

const DYNAMIC_RULE_ID = 1;

const interceptedResources = {
  videos: new Map(),
};

// declarativeNetRequest：注入 Referer
async function ensureDownloadRule() {
  try {
    await chrome.declarativeNetRequest.updateDynamicRules({ removeRuleIds: [DYNAMIC_RULE_ID] });
  } catch (e) {}

  await chrome.declarativeNetRequest.updateDynamicRules({
    addRules: [
      {
        id: DYNAMIC_RULE_ID,
        priority: 1,
        action: {
          type: "modifyHeaders",
          requestHeaders: [
            { header: "Referer", operation: "set", value: "https://www.xiaohongshu.com/" },
            { header: "Origin", operation: "set", value: "https://www.xiaohongshu.com" },
          ],
        },
        condition: {
          urlFilter: "*xhscdn*",
          resourceTypes: ["xmlhttprequest", "other", "media", "image"],
        },
      },
    ],
  });
}

ensureDownloadRule();

// webRequest 监听：拦截视频请求
chrome.webRequest.onCompleted.addListener(
  (details) => {
    const url = details.url;
    if (!url.includes("xhscdn.com")) return;
    if (/\/stream\//.test(url) || /\.mp4(\?|$)/i.test(url) || /sns-video/.test(url)) {
      if (!interceptedResources.videos.has(url)) {
        interceptedResources.videos.set(url, { url, type: "webRequest", timestamp: Date.now() });
      }
    }
  },
  { urls: ["https://*.xhscdn.com/*", "https://xhscdn.com/*"] }
);

// 定期清理
setInterval(() => {
  const now = Date.now();
  for (const [url, data] of interceptedResources.videos) {
    if (now - data.timestamp > 30 * 60 * 1000) interceptedResources.videos.delete(url);
  }
}, 5 * 60 * 1000);

// 消息处理
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (msg.action === "getInterceptedResources") {
    sendResponse({ videos: Array.from(interceptedResources.videos.values()) });
    return false;
  }
});
