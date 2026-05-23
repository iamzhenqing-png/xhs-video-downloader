# 小红书视频图片下载器

一款 Chrome 浏览器扩展，一键提取和下载小红书网站的视频和图片，无需登录。

## 功能特性

- **视频下载** — 自动检测页面视频，支持多种画质选择
- **图片下载** — 自动提取笔记中的所有图片（原图），支持缩略图预览
- **批量下载** — 一键下载所有图片，带进度反馈
- **短链接支持** — 支持 `xhslink.com` 短链接自动解析
- **多种提取策略** — DOM 检测 + SSR 数据解析 + Performance API + 网络请求拦截，确保高成功率
- **笔记标题命名** — 下载文件自动以笔记标题命名

## 安装方法

1. 打开 Chrome，进入 `chrome://extensions/`
2. 开启右上角「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目的 `xhs-video-downloader` 文件夹

## 使用方法

1. 打开小红书笔记页面（如 `https://www.xiaohongshu.com/explore/xxxxx`）
2. 点击浏览器工具栏的插件图标
3. 插件自动扫描页面中的视频和图片
4. 切换「视频」/「图片」标签页，点击下载按钮
5. 图片可点击缩略图单张下载，或点击「下载全部图片」批量下载

也可以在输入框中粘贴笔记链接手动解析。

## 技术架构

```
┌─────────────┐     ┌──────────────┐     ┌──────────────┐
│  Popup UI    │────▶│ Content Script│────▶│  Background   │
│  视频/图片   │     │  页面数据提取  │     │  下载管理     │
│  Tab 切换    │◀────│  DOM/SSR/性能  │     │  webRequest   │
│  批量下载    │     │  API 拦截     │     │  Referer注入  │
└─────────────┘     └──────────────┘     └──────────────┘
```

### 资源提取策略（按可靠性排序）

| 优先级 | 策略 | 说明 |
|--------|------|------|
| 1 | DOM 检测 | 从 `<video>` / `<img>` 元素直接读取 |
| 2 | SSR 数据 | 解析 `__INITIAL_STATE__` 获取完整笔记数据 |
| 3 | Performance API | 读取浏览器已加载的资源记录 |
| 4 | 页面正则匹配 | 从 script 标签中匹配 CDN URL |
| 5 | webRequest 监听 | 后台拦截所有 xhscdn.com 网络请求 |

### 下载策略

- **优先方案**：通过 content script 在页面内 fetch + `<a>` 标签触发下载（自动携带 cookie/referer，绕过防盗链）
- **备用方案**：background fetch 转 blob + `chrome.downloads` API

## 文件结构

```
xhs-video-downloader/
├── manifest.json       # 扩展配置
├── popup.html          # 弹窗 UI
├── popup.css           # 弹窗样式
├── popup.js            # 弹窗逻辑
├── content.js          # 页面内容提取脚本
├── background.js       # 后台服务（下载管理、网络监听）
├── icons/              # 扩展图标
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md
```

## 注意事项

- 仅在 `xiaohongshu.com` 域名下生效
- 视频和图片资源托管在 `xhscdn.com`，插件会自动注入 Referer 头绕过防盗链
- 小红书可能更新页面结构，如果插件失效请提 Issue
- 仅供个人学习使用，请尊重原创作者权益
