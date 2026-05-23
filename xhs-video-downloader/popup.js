// 小红书视频链接提取 - Popup（极简版，只提取链接）

document.addEventListener("DOMContentLoaded", async () => {
  const statusEl = document.getElementById("status");
  const linksEl = document.getElementById("links");
  const emptyEl = document.getElementById("empty");

  function setStatus(type, text) {
    statusEl.className = `status ${type}`;
    statusEl.textContent = text;
  }

  async function getActiveTab() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    return tab;
  }

  async function scan() {
    const tab = await getActiveTab();
    if (!tab.url || !tab.url.includes("xiaohongshu.com")) {
      setStatus("error", "请打开小红书页面后使用");
      emptyEl.classList.remove("hidden");
      return;
    }

    setStatus("loading", "正在扫描页面视频...");

    // 1. 从 content script 获取
    let videos = [];
    try {
      const csResponse = await new Promise((resolve) => {
        chrome.tabs.sendMessage(tab.id, { action: "scan" }, (resp) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(resp);
        });
      });
      if (csResponse?.videos?.length) {
        videos = csResponse.videos;
      }
    } catch (e) {}

    // 2. 从 background webRequest 拦截获取
    try {
      const bgResponse = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "getInterceptedResources" }, (resp) => {
          if (chrome.runtime.lastError) resolve(null);
          else resolve(resp);
        });
      });
      if (bgResponse?.videos?.length) {
        const seen = new Set(videos.map((v) => v.url));
        bgResponse.videos.forEach((v) => {
          if (!seen.has(v.url)) {
            videos.push({ url: v.url, quality: "网络监听", source: "webRequest" });
            seen.add(v.url);
          }
        });
      }
    } catch (e) {}

    // 去重
    const seen = new Set();
    videos = videos.filter((v) => {
      if (seen.has(v.url)) return false;
      seen.add(v.url);
      return true;
    });

    if (videos.length === 0) {
      setStatus("error", "未检测到视频链接");
      emptyEl.classList.remove("hidden");
      return;
    }

    setStatus("success", `检测到 ${videos.length} 个视频链接`);
    emptyEl.classList.add("hidden");
    renderLinks(videos);
  }

  function renderLinks(videos) {
    linksEl.innerHTML = "";
    videos.forEach((video, i) => {
      const item = document.createElement("div");
      item.className = "link-item";
      item.innerHTML = `
        <div class="link-meta">${video.quality || "视频"} · ${video.source || "页面检测"}</div>
        <div class="link-url" id="url_${i}">${video.url}</div>
        <div class="btn-row">
          <button class="btn btn-copy" data-url="${video.url}" data-index="${i}">📋 复制链接</button>
          <button class="btn btn-open" data-url="${video.url}">🔗 新标签页打开</button>
        </div>
      `;
      linksEl.appendChild(item);
    });

    // 复制按钮
    linksEl.querySelectorAll(".btn-copy").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const url = btn.dataset.url;
        try {
          await navigator.clipboard.writeText(url);
          btn.textContent = "✅ 已复制";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "📋 复制链接";
            btn.classList.remove("copied");
          }, 2000);
        } catch (e) {
          // fallback: select text
          const urlEl = document.getElementById(`url_${btn.dataset.index}`);
          const range = document.createRange();
          range.selectNodeContents(urlEl);
          const sel = window.getSelection();
          sel.removeAllRanges();
          sel.addRange(range);
          document.execCommand("copy");
          btn.textContent = "✅ 已复制";
          btn.classList.add("copied");
          setTimeout(() => {
            btn.textContent = "📋 复制链接";
            btn.classList.remove("copied");
          }, 2000);
        }
      });
    });

    // 新标签页打开
    linksEl.querySelectorAll(".btn-open").forEach((btn) => {
      btn.addEventListener("click", () => {
        chrome.tabs.create({ url: btn.dataset.url });
      });
    });
  }

  scan();
});
