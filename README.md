# 音乐剧数字排演空间

这是依据 [PRD](docs/PRD.md) 开发中的本地网页 MVP。当前已经可以创建剧目、选择首个站位、编辑演员与道具、编排 Position 和 Transition、上传音乐，以及使用 Next 和预演模式检查走位。
<img width="1863" height="942" alt="1e32ef8ba79cb8448891079547119343" src="https://github.com/user-attachments/assets/6f525ff6-f1f1-4c13-960f-51c6f73c9182" />
<img width="1863" height="942" alt="image" src="https://github.com/user-attachments/assets/e3876c51-27d2-4e08-ac95-0ecbed7bad00" />

<img width="1858" height="1542" alt="850c06ac5d700323e75b9295ec3f1404" src="https://github.com/user-attachments/assets/47eafe92-4981-43d7-a29e-c433cbe651a0" />
<img width="1863" height="942" alt="8a05dddcf4d4fa4b0f0dcc1725716ff7" src="https://github.com/user-attachments/assets/27227989-9e6f-4278-b1a6-aca4a3f7f7d4" />



在项目目录运行：

```powershell
npm install
npm run dev
```

然后打开终端显示的本地地址。每次更新后可运行 `npm run build` 检查构建；开发服务器运行时可执行 `npm run test:e2e` 检查关键用户流程（本机需安装 Chrome）。

剧目数据保存在当前浏览器的本地存储中，上传的音频文件保存在当前浏览器的 IndexedDB 中。清除浏览器站点数据会删除这些内容；本期没有云端同步和导出功能。后续开发顺序及尚未完成的细节见 [开发计划](docs/development-plan.md)。
