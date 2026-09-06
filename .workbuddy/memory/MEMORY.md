# vault-encrypt 项目长期记忆

## 项目约定

- **样式源头是 `src/styles.css`**：`esbuild.config.mjs` 生产构建会把它覆盖到根目录 `styles.css`，再拷到 dist。**永远不要直接编辑根目录 `styles.css`**（那是构建产物，改动会在下次 build 时被冲掉）。
- 构建：`npm run build`（tsc 类型检查 + esbuild 打包），产物在 `dist/vault-encrypt-<version>/`（main.js / manifest.json / styles.css + zip）。
- 版本三处同步：`manifest.json` / `package.json` / `versions.json`。升级命令：`npm version patch|minor|major --no-git-tag-version`（`version-bump.mjs` 是 npm version 生命周期钩子，读 `npm_package_version` 同步 manifest/versions，**不接受 patch 参数**，`npm run version -- patch` 无效）。
- i18n：`src/i18n/index.ts`，en + zh-cn 双语，新增功能键必须两边补齐。
- Obsidian 文件管理器右键文件夹只触发 `file-menu`（无单独 folder-menu），菜单需双挂。
- 加密图标方案：纯 CSS class 切换（`ve-encrypted-file` / `ve-marked-folder`），不往 DOM 插图标——主题可能用伪元素/背景画 glyph，DOM 方案会产生双图标。

## 红线（沿用全局）

- 未经用户明确指令，不执行 git commit / push / tag；发布默认仅本地 commit。
- 不主动定位/拷贝 vault 插件目录，用户自行同步构建产物。
