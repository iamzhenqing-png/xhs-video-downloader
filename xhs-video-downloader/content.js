// 小红书视频链接提取 - Content Script（极简版）
// 只负责从页面提取视频 URL，不做任何下载

(function () {
  "use strict";

  function cleanUrl(url) {
    return url
      .replace(/\\u002F/g, "/")
      .replace(/\\u0026/g, "&")
      .replace(/\\/g, "")
      .trim();
  }

  // ==================== 策略1: DOM 提取 ====================
  function extractVideosFromDOM() {
    const videos = [];
    const seen = new Set();
    document.querySelectorAll("video").forEach((v) => {
      const src = v.src || v.currentSrc;
      if (src && src.startsWith("http") && !seen.has(src)) {
        seen.add(src);
        videos.push({ url: cleanUrl(src), quality: "DOM检测", source: "video元素" });
      }
      v.querySelectorAll("source").forEach((s) => {
        if (s.src && s.src.startsWith("http") && !seen.has(s.src)) {
          seen.add(s.src);
          videos.push({ url: cleanUrl(s.src), quality: "DOM检测", source: "source元素" });
        }
      });
    });
    return videos;
  }

  // ==================== 策略2: SSR 数据 ====================
  function extractFromSSRData() {
    const videos = [];
    const seen = new Set();

    const scripts = document.querySelectorAll("script");
    for (const script of scripts) {
      const text = script.textContent || "";
      const stateMatch = text.match(/window\.__INITIAL_STATE__\s*=\s*(\{.+?\})\s*(?:<\/script>|$)/s);
      if (!stateMatch) continue;

      let state;
      try {
        state = JSON.parse(stateMatch[1]);
      } catch (e) {
        try {
          state = JSON.parse(
            stateMatch[1].replace(/undefined/g, "null").replace(/\\u002F/g, "/").replace(/\\u0026/g, "&")
          );
        } catch (e2) {
          continue;
        }
      }
      if (!state) continue;

      const noteDetailMap = state?.note?.noteDetailMap || state?.note?.note?.noteDetailMap;
      if (!noteDetailMap) continue;

      for (const key of Object.keys(noteDetailMap)) {
        const note = noteDetailMap[key]?.note;
        if (!note?.video) continue;
        const video = note.video;

        if (video.consumer?.origin_video_key) {
          const url = `https://sns-video-bd.xhscdn.com/${video.consumer.origin_video_key}`;
          if (!seen.has(url)) {
            seen.add(url);
            videos.unshift({
              url,
              quality: `原画 ${video.width || ""}x${video.height || ""}`.trim(),
              source: "SSR数据",
            });
          }
        }

        if (video.media_stream) {
          for (const codec of ["h264", "h265"]) {
            const streams = video.media_stream[codec];
            if (!streams?.length) continue;
            for (const stream of streams) {
              const streamUrl = stream.master_url || stream.backup_urls?.[0] || stream.stream_url;
              if (streamUrl) {
                const clean = cleanUrl(streamUrl);
                if (!seen.has(clean)) {
                  seen.add(clean);
                  videos.push({
                    url: clean,
                    quality: `${codec.toUpperCase()} ${stream.quality_type || ""}`.trim(),
                    source: "SSR数据",
                  });
                }
              }
            }
          }
        }
      }
    }
    return videos;
  }

  // ==================== 策略3: Performance API ====================
  function extractFromPerformance() {
    const videos = [];
    const seen = new Set();
    try {
      performance.getEntriesByType("resource").forEach((entry) => {
        const url = entry.name;
        if (!url.includes("xhscdn.com")) return;
        if (/\/stream\//.test(url) || /\.mp4(\?|$)/i.test(url) || /sns-video/.test(url)) {
          const clean = cleanUrl(url);
          if (!seen.has(clean)) {
            seen.add(clean);
            videos.push({ url: clean, quality: "网络请求", source: "Performance API" });
          }
        }
      });
    } catch (e) {}
    return videos;
  }

  // ==================== 策略4: 正则匹配页面脚本 ====================
  function extractFromScripts() {
    const videos = [];
    const seen = new Set();
    document.querySelectorAll("script").forEach((script) => {
      const text = script.textContent || "";
      for (const pattern of [
        /https?:\/\/[^\s"'\\]+\.mp4[^\s"'\\]*/g,
        /https?:\/\/[^\s"'\\]*xhscdn\.com[^\s"'\\]*stream[^\s"'\\]*/g,
        /https?:\/\/sns-video[^\s"'\\]*xhscdn\.com[^\s"'\\]*/g,
      ]) {
        (text.match(pattern) || []).forEach((url) => {
          const clean = cleanUrl(url);
          if (!seen.has(clean)) {
            seen.add(clean);
            videos.push({ url: clean, quality: "标清", source: "页面匹配" });
          }
        });
      }
    });
    return videos;
  }

  // ==================== 核心扫描 ====================
  function scanAll() {
    const allVideos = [];
    const seen = new Set();

    function add(v) {
      if (!seen.has(v.url) && v.url.startsWith("http")) {
        seen.add(v.url);
        allVideos.push(v);
      }
    }

    extractVideosFromDOM().forEach(add);
    extractFromSSRData().forEach(add);
    extractFromPerformance().forEach(add);
    extractFromScripts().forEach(add);

    return { videos: allVideos };
  }

  // ==================== 消息监听 ====================
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "scan") {
      sendResponse(scanAll());
      return false;
    }
  });

  console.log("[XHS视频链接提取] 已加载");
})();
