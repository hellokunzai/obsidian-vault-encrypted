# Vault Encrypt — 整包加密容器（方案 A）技术方案

> 目标：右键「锁定文件夹」后，整个文件夹（含子文件夹、所有文件、图片/PDF 等二进制）从 Obsidian 文件树**彻底消失**，只留下一个加密包文件 `xxx.vaultenc`；没密码既看不到内容，也打不开。右键「解锁文件夹」输入正确密码后，原文件夹原样还原回原位。

---

## 一、为什么现有实现做不到

当前 `feature-folder-encrypt` 是**逐文件加密**：把每个 `.md` 变成 `xxx.md.mdenc`，文件夹结构、文件名、子文件夹**全部留在文件树里**，只是单个文件打不开。这不符合「没密码连文件夹都看不到」。

整包加密(A) 需要把整个文件夹**作为一个整体**打包 + 加密 + 从 vault 移除。

---

## 二、存储格式（`.vaultenc` 容器）

容器本身是一个**二进制文件**，不用现有文本 JSON 格式（那样没法装二进制资源，且体积爆炸）。

```
.vaultenc 文件结构（二进制）：
┌─────────────────────────────────────────────┐
│ Magic: "VMELD1" (6 bytes)                     │ ← 标识文件类型
│ Salt: 16 bytes                               │ ← 派生密钥用
│ Nonce/IV: 12 bytes                           │ ← AES-GCM 初始向量
│ Hint length (4 bytes) + Hint (utf8)          │ ← 密码提示，明文
│ Encrypted payload:                           │
│   {                                           │
│     "manifest": [                            │
│       {"path":"a/b.md","type":"text","size":123},
│       {"path":"a/img.png","type":"bin","size":4567}
│     ],                         
│     "files": [ <每个文件的密文 blob，按 manifest 顺序拼接> ]
│   }                                           │
└─────────────────────────────────────────────┘
```

要点：
- **密钥派生**：用 `PBKDF2(password, salt, 迭代)` 派生 AES-GCM 256 密钥（复用仓库已有的 `CryptoHelperFactory`，或新增 `CryptoHelperFactory.BuildForBinary()`）。
- **加密算法**：AES-GCM（自带完整性校验），密码错 → 解密直接失败，不会还原出乱码。
- **密码提示明文存**：和现有单文件加密行为一致（hint 本来就是明文的）。
- **manifest 明文 vs 密文**：为简单与稳妥，第一版把 `manifest + 文件 blob` 整体加密成一个 payload（即「整个包一个密文」）。好处：目录结构、文件名也一并保密；坏处：解锁时必须整包解密才能看结构（可接受，因为本来就要还原）。

---

## 三、加密（锁定）流程

1. 用户在文件树右键文件夹 `Secret/` → 「锁定文件夹」。
2. `FolderVaultService.lock(folderPath, password, hint)`：
   a. 用 `vault.adapter.list(folderPath)` 递归收集所有文件路径（保留相对路径，如 `Secret/sub/note.md`）。
   b. 逐个 `vault.adapter.readBinary` 读原始字节；文本文件直接按 utf8 读字节、二进制按 arraybuffer。
   c. 把所有文件字节 + manifest 拼成一个 ArrayBuffer。
   d. `AES-GCM` 加密 → 写 `Secret.vaultenc` 到 `folderPath` 的**父目录**（即 `Secret/` 同级，文件名 `Secret.vaultenc`）。
   e. **关键**：`vault.adapter.rmdir(folderPath, true)` 递归删除原文件夹（先确认 `.vaultenc` 已落盘成功，再做删除）。
   f. 触发 `vault.refresh()` 让文件树更新 → `Secret/` 消失，只剩 `Secret.vaultenc`。
3. 若中途失败（如某文件正在被编辑）：提示并**中止**，不删原文件夹（保证不丢数据）。

> 打开中文件处理：锁定前先 `workspace.iterateAllLeaves` 把属于该文件夹的 leaf detach，避免 Obsidian 持有句柄导致删除失败 / 写冲突。

---

## 四、解密（解锁）流程

1. 右键 `.vaultenc` 文件 → 「解锁文件夹」（也支持设置页/命令触发）。
2. `FolderVaultService.unlock(vaultencPath, password)`：
   a. 读二进制 → 校验 Magic。
   b. `AES-GCM` 解密（密码错 → 直接报「密码错误」，文件保留不破坏）。
   c. 解析 manifest，在 `vaultenc` **同级**重建原文件夹：`adapter.mkdir` 逐层建目录，`adapter.writeBinary` 还原每个文件。
   d. 删除 `.vaultenc`（还原成功后）。
   e. `vault.refresh()` → 原文件夹完整回来。
3. 还原后尝试重新打开解锁前正在编辑的文件（可选，第一版先不自动重开）。

---

## 五、文件树「看不到文件夹」如何实现

整包加密天然做到：原文件夹被 `rmdir` 删除后，Obsidian 文件树里它就不存在了，只剩一个 `.vaultenc`（显示为普通文件，图标可自定义为锁）。**无需 hack 文件树渲染**，这是方案 A 相比方案 B 的最大优势。

---

## 六、改动清单（预估）

| 文件 | 改动 |
|---|---|
| `src/services/FolderVaultService.ts` | **新增**。核心：lock / unlock / 打包 / 还原 / 密钥派生。 |
| `src/services/CryptoHelperFactory.ts` | 新增二进制 AES-GCM 封装（若不存在）。 |
| `src/features/feature-folder-encrypt/FeatureFolderEncrypt.ts` | 右键菜单文案改「锁定文件夹 / 解锁文件夹」；`file-menu` 同时识别 `.vaultenc` 文件 → 显示「解锁文件夹」。 |
| `src/features/feature-folder-encrypt/FolderEncryptModal.ts` | 改为整包加密 UI：选文件夹/选 .vaultenc、输密码、锁/解锁。 |
| `src/i18n/index.ts` | 新增 `menu.lockFolder` / `menu.unlockFolder` / 相关 notice、modal 文案。 |
| `manifest.json` | 无需改（无新权限）。 |
| `styles.css` | 可选：给 `.vaultenc` 文件加锁图标样式。 |

---

## 七、风险与回滚

| 风险 | 缓解 |
|---|---|
| 加密中途崩溃导致原文件夹删了但包没写好 → 数据丢失 | 严格顺序：先**完整写好 .vaultenc 并校验可读**，再删原文件夹。任何一步失败立即中止且不删。 |
| 密码遗忘 | 同单文件加密：存 hint；无找回机制（设计如此）。 |
| 大文件夹加密慢 / 内存爆 | 第一版整体读入内存（家用 vault 通常 < 几百 MB）；后续可改流式。当前在 modal 显示进度。 |
| 同步盘（Gitee/GitHub）冲突 | `.vaultenc` 是单文件，同步比「一堆 .mdenc」友好得多；这正是方案 A 的额外收益。 |
| 误删 .vaultenc | 无自动备份；建议文档提示用户「.vaultenc 即你的保险箱，勿删」。 |

---

## 八、验证步骤

1. 新建测试文件夹 `Secret/`，里面放 2 个 md + 1 个子文件夹 + 1 张图片。
2. 右键 `Secret/` → 「锁定文件夹」→ 设密码 → 确认文件树里 `Secret/` 消失、出现 `Secret.vaultenc`。
3. 双击 `Secret.vaultenc` 或右键 → 「解锁文件夹」→ 输错密码应失败；输对 → `Secret/` 完整还原，内容与原来一致（md 可读、图片正常）。
4. 验证原 `Secret/` 下正在打开的笔记在锁定前被正确关闭。

---

## 九、待你确认的点

- [ ] 容器扩展名用 `.vaultenc` 是否 OK？
- [ ] 解锁后是否自动重开之前打开的笔记？（第一版默认不自动重开）
- [ ] 是否要支持「锁定后保留原文件夹名的一个空占位」？→ 默认**不保留**，彻底消失。
- [ ] 第一版整体读入内存是否可接受？（你的 vault 文件夹一般多大？）
