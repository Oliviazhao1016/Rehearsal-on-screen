# 音乐剧数字排演空间

这是依据 [PRD](docs/PRD.md) 开发中的本地网页 MVP。当前已经可以创建剧目、选择首个站位、编辑演员与道具、编排 Position 和 Transition、上传音乐，以及使用 Next 和预演模式检查走位。

在项目目录运行：

```powershell
npm install
npm run dev
```

然后打开终端显示的本地地址。每次更新后可运行 `npm run build` 检查构建；开发服务器运行时可执行 `npm run test:e2e` 检查关键用户流程（本机需安装 Chrome）。

剧目数据保存在当前浏览器的本地存储中，上传的音频文件保存在当前浏览器的 IndexedDB 中。清除浏览器站点数据会删除这些内容；本期没有云端同步和导出功能。后续开发顺序及尚未完成的细节见 [开发计划](docs/development-plan.md)。
