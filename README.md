# Antigravity 简体中文补充包

为已经安装[船板主题补丁](https://github.com/Anarcadia/chuanban-antigravity-theme-patch)的 Antigravity 桌面客户端补齐英文提示。

在 Windows 上以 **Antigravity 2.33.0 + 船板 v5.4.3 + Node.js 24.18.1** 验证。基础主题、连接、自启和主词库由上游提供；本项目补充搜索引导、快捷键无障碍标签、模型额度说明、反馈提示、内置技能介绍，以及实时指标的中文标签。保留产品名、模型名、快捷键、技能标识和文件路径。

这是社区补充包，与 Google、Anthropic 均无隶属关系。目标是尽量覆盖产品界面，不承诺所有插件、系统原生对话框及未来版本均已完整翻译。

v1.0.0 包含 **230 条增补或覆盖词条**；本次与上游合并后实际加载 **2,007 条**。词条数量用于核对加载状态，不代表翻译覆盖率。

## 安装

### 1. 准备上游补丁

需要 Node.js 22 或更新版本。先保存工作并正常退出客户端；不要强制结束正在执行的任务。

尚未安装上游补丁时，可使用本次验证的固定提交：

```powershell
git clone https://github.com/Anarcadia/chuanban-antigravity-theme-patch.git
cd chuanban-antigravity-theme-patch
git checkout 0af9c2e95fb2d50f311eadad67a6604e95b1b201
node install.mjs doctor
node install.mjs install --channel stable
```

已有上游补丁时不必重复安装。上游运行目录默认为 `%USERPROFILE%\.gemini\antigravity\theme-patch`。额外字体仅影响外观，本项目汉化不需要下载大型字体包。

### 2. 让 Windows 2.33.0 开放本地调试端口

在本次测试的 2.33.0 中，未带调试参数启动时没有可用的默认 CDP 端口，且本机没有旧版 `.antigravity/argv.json`。上游安装成功提示不等于界面已经生效。

右键现有 Antigravity 快捷方式 → 属性，在“目标”原路径之后追加：

```text
--remote-debugging-address=127.0.0.1 --remote-debugging-port=9222
```

保留 exe 路径原有引号。例如：

```text
"C:\路径\Antigravity.exe" --remote-debugging-address=127.0.0.1 --remote-debugging-port=9222
```

备份原快捷方式，并给实际使用的桌面、开始菜单快捷方式都加上参数，然后正常启动客户端。仅使用本机环回地址；不要将调试端口改为对外监听。客户端更新重新生成快捷方式后，可能需要重新添加参数。

### 3. 安装本补充包

下载本仓库 ZIP 并解压，或克隆仓库后，在本项目目录执行：

```powershell
node install.mjs install
node check.mjs
```

不需要 npm 依赖、管理员权限或构建。安装器会备份已有的 `user/custom.js` 与 `user/i18n.override.json`，合并补充词条，追加自定义钩子。上游守护进程通常会在数秒内热加载。若检查提示尚未加载，确认客户端正在运行并再检查一次。

自定义安装位置：

```powershell
node install.mjs install --patch-dir "D:\已有补丁目录"
```

本安装器不改 `core/`、客户端程序、账号、聊天内容和项目归属，也不自行修改快捷方式或新建自启任务。

## 验证

```powershell
node test.mjs       # 离线检查安装、备份、数据保护和卸载
node check.mjs      # 需要正在运行的客户端，检查实际扩展及独立 DOM 测试
node check.mjs 9222 # 可显式指定本机调试端口
```

`check.mjs` 在独立 HTML 文档中检查搜索引导、图标保留、指标、设置、无障碍标签、动态刷新时间、正文与代码保护、热更新和清理；不会向模型发送消息，也不会把测试内容写入实际对话。

本次实测记录见 [VALIDATION.json](VALIDATION.json)，完整安装与排查过程见 [PROCESS.md](PROCESS.md)。

## 卸载与回退

仅撤销本补充包：

```powershell
node install.mjs uninstall
```

它恢复首次安装前的两份用户文件，保留上游补丁。重复安装不会叠加脚本。如果用户后来手动修改了这两份文件，安装器会拒绝覆盖；先另存改动，按报错中给出的文件手动合并。

如需恢复整个客户端的英文界面，在上游补丁目录运行：

```powershell
node install.mjs uninstall
```

注意区分两个项目中的同名 `install.mjs`。上游命令会停止守护、自启并撤销其运行时样式。随后正常退出客户端，恢复原快捷方式或移除本次追加的两个参数，再次打开即可。

## 范围与维护

- 只翻译界面说明，不翻译聊天正文、输入内容、代码、终端或文件路径。
- 搜索引导中的 Markdown 只对白名单产品卡片放行；普通 Markdown 继续受保护。
- 指标只改标签与秒数单位，保留数值、比例和统计来源。`词元`对应 token，数量单位 k、M 保留。
- 上游升级后保留 `user/` 不代表必然兼容；应重跑检查，并核对选择器和词条。
- 没有覆盖到的英文可通过议题反馈原文、客户端版本及去除个人信息后的截图。

## 来源与许可证

基础运行时来源：**Anarcadia/chuanban-antigravity-theme-patch**，本次使用提交 `0af9c2e95fb2d50f311eadad67a6604e95b1b201`。感谢上游提供连接、主题和基础汉化能力。

本仓库只包含独立编写的补充钩子、增补词条、安装器、检查程序与文档，采用 [MIT](LICENSE)。未重新分发上游 `core/`、客户端代码、字体或完整原词库；MIT 不改变这些第三方作品及名称原有的权利归属。内置技能说明的译文仅改变设置页显示，执行时仍使用原始技能文件。
