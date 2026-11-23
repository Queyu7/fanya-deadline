# 课期 · 泛雅作业看板

在本机按截止时间汇总学习通泛雅「我学的课」中未完成的作业，不需要给第三方服务提供账号。适配桌面版泛雅；非超星官方产品。

## 下载与首次使用

从 [GitHub Releases](https://github.com/Queyu7/fanya-deadline/releases/latest) 下载。macOS 按 Apple Silicon 或 Intel 选择 ZIP，解压移动到应用程序；Windows x64 解压整个文件夹后启动 Keqi.exe；Android 8 及以上安装 APK。Android 包使用项目固定发布密钥签名。桌面包没有商业签名或 Apple 公证，请按学校和设备的安全策略使用；发布页提供 SHA-256 校验文件。

1. 点击 **平台登录**，在官方泛雅页面登录自己的账号。看到课程首页后关闭登录窗口（Android 点「完成登录」）。应用不读取已有 Chrome 登录态。
2. 点击 **同步全部课程**。应用依次访问当前在学课程的作业列表，不打开或提交作业。首次同步可能需要几分钟。已有数据时，看板在前台每半小时尝试刷新，也可手动刷新。
3. 看板默认最近截止优先，可切换排序。平台只显示倒计时时以「约」标记；未提供时间的作业在末尾，不能设置定时通知。显示时间为北京时间。
4. 开启 **系统通知** 并选择提前量。进入提醒窗口的作业立即提醒；已完成的作业在下一次成功同步后移除。桌面应用需要保持运行（可以最小化）。Android 已同步的提醒可以在关闭界面后触发，重启后恢复。系统省电、强制停止或禁用通知可能延迟或阻止投递。

## 数据和适配范围

登录由超星页面处理。登录态和作业快照保存在本机应用数据中，不会发送到 GitHub 或项目服务器；设备之间不共享账号和数据。请勿在共享设备上混用账号。仅覆盖当前「我学的课 → 作业」，不包含考试、章节任务点、已结束课程或非超星域名的学校单点登录。识别失败时保留该课的历史记录并提示，不把失败当作零作业。平台调整结构或分页时请查看同步详情。

## 构建

桌面：Node.js 24+，`npm ci`、`npm test`、`npm start`。`npm run package -- darwin arm64` 或 `npm run package -- win32 x64` 生成可分发目录。Android：JDK 17、Android SDK Platform 35 和 Build Tools 35.0.0；设置 `ANDROID_HOME`、`KEYSTORE`（PKCS12，别名 keqi）和 `ANDROID_PASS`，运行 `bash scripts/android.sh`。推送版本标签后，GitHub Actions 执行测试、分别构建三端，全部成功才创建 Release。仓库 Secrets `ANDROID_STORE` 为发布密钥库的 Base64，`ANDROID_PASS` 为密钥口令。不要将密钥库或真实课程页面提交到仓库。
