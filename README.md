# [Vault Encrypted](https://github.com/hellokunzai/obsidian-vault-encrypted) Plugin for Obsidian

**Hide secrets inside your [Obsidian.md](https://obsidian.md/) vault.**

[Vault Encrypted](https://github.com/hellokunzai/obsidian-vault-encrypted) is a community plugin that lets you encrypt and decrypt content in [Obsidian](https://obsidian.md/). You can encrypt an [entire note](https://github.com/hellokunzai/obsidian-vault-encrypted) or just [selected text within a note](https://github.com/hellokunzai/obsidian-vault-encrypted), and bulk-encrypt a whole folder.

Encrypted content is never written to disk in plaintext, giving you peace of mind that the decrypted text is never synced or backed up to external systems.

> This plugin was forked from [Meld Encrypt](https://github.com/meld-cp/obsidian-encrypt) and renamed to **Vault Encrypted**. It is maintained at <https://github.com/hellokunzai/obsidian-vault-encrypted>.

---

> [!WARNING]
> ⚠️ Use at Your Own Risk ⚠️
> - Your passwords are never stored by the plugin. If you forget your password, your notes **cannot** be decrypted.
> - The encryption methods used have not been independently audited. Unauthorized access may be possible if someone gains access to your files.
> - Bugs may be introduced at any time. You are solely responsible for maintaining backups of your notes.

---

## Features

### 1. Whole Note Encryption
Encrypt an entire note so its contents are completely unreadable without a password.

- **New encrypted note** — `Ctrl/Cmd+P` → *Create new encrypted note*, or right-click a folder in the File Explorer → *New encrypted note*.
- **Convert existing note** — `Ctrl/Cmd+P` → *Convert to or from an Encrypted note*, or right-click a `.md` file → *Encrypt note* / right-click an encrypted file → *Decrypt note*.
- Encrypted notes open in a dedicated locked view. You are prompted for the password each time; you can **change the password**, or **lock & close** a note.
- Use the command **Lock and Close all open encrypted notes** to lock everything at once.

### 2. Inline Encryption (行内加密)
Encrypt only a portion of a note, keeping the rest readable.

- **Encrypt Selection** — select text, then `Ctrl/Cmd+P` → *Encrypt Selection* (or right-click → *Encrypt Selection*).
- **Decrypt Selection** — right-click an encrypted block → *Decrypt Selection* (in Live Preview the block is replaced with the original plaintext in place). In Reading view, double-click the rendered `🔐` block to reveal it.
- Encrypted text is stored in the new `encrypt(visible text){cipher}` format. The *visible text* is shown in Reading view as a clickable marker; the *cipher* is the encrypted payload.
- Legacy `🔐β …` / `🔐α …` markers from older versions are still decrypted for backward compatibility.
- An optional **password hint** can be attached to help you remember the password.

### 3. Folder Encryption

#### 3.1 Mark a folder as encrypted (auto-encrypt)
Flag a folder as *encrypted* and every **new** `.md` note created inside it is converted to an encrypted `.mdenc` file automatically; notes moved into the folder are encrypted too. The password lives in memory only (never on disk) and follows Obsidian's Keychain / session-cache conventions.

- Right-click a folder in the File Explorer → *Mark folder as encrypted*, set a password (optional hint), choose recursive sub-folders, and whether to **also encrypt the notes already inside** (on by default).
- Marked folders and encrypted files show a 🔒 lock icon in the File Explorer.
- Right-click a marked folder to *Unmark* (removes the flag only — no bulk decrypt) or *Encrypt existing notes*.
- Command *Mark / unmark folder of current note* targets the active note's folder.
- The settings tab lists every marked folder with a remove button; renaming / moving / deleting a marked folder keeps the marks in sync automatically.

#### 3.2 One-shot bulk encrypt / decrypt
- Right-click a folder → *Decrypt folder*, or use commands *Encrypt folder of current note* / *Decrypt folder of current note* for a one-shot bulk operation (recursive by default).
- A summary reports succeeded / skipped / failed counts.

### 4. Random Password Generator
- Ribbon icon or `Ctrl/Cmd+P` → *Generate Random Password* opens a modal where you set length (1–256) and toggle character classes (uppercase, lowercase, numbers, symbols). Regenerate and copy with one click.

### 5. Session Password Cache
- When **Remember password** is on, the last used password is cached automatically (keyed to the note or folder) until Obsidian closes or the timeout elapses.
- **Clear Session Password Cache** wipes the cache immediately.

---

## Encryption

All cryptography is performed locally with the Web Crypto API (`crypto.subtle`), which is available in both Obsidian's desktop and mobile runtimes. Three schemes exist and are selected automatically by a **version marker** embedded in the ciphertext, so encrypted data created by older versions remains decryptable. **All new encryptions use version 2 (β).**

| Version | Marker | Key derivation | Cipher | Notes |
| --- | --- | --- | --- | --- |
| **2 (default, β)** | `🔐β` | PBKDF2-HMAC-**SHA-512**, **210,000** iterations, random 16-byte salt | AES-**256**-GCM, random 16-byte IV | Current standard. Iteration count aligns with OWASP guidance for PBKDF2-SHA512. |
| **1 (α)** | `🔐α` | PBKDF2-HMAC-SHA-256, 1,000 iterations, hardcoded salt (`XHWnDAT6ehMVY2zD`) | AES-256-GCM, random 16-byte IV | Retained for backward compatibility only; low iterations and a static salt. |
| **0 (obsolete)** | `🔐` | `SHA-256(password)` used directly as the key — no PBKDF2, no salt | AES-256-GCM, **fixed** 12-byte IV | Insecure: nonce reuse plus an unsalted key. Never used to create new ciphertext. |

### Data format

- **Whole-note / file encryption** writes a JSON envelope: `{ "version": "2.0", "hint": "<password hint>", "encodedData": "<Base64>" }`. The Base64 payload is laid out as `IV(16 bytes) ‖ salt(16 bytes) ‖ AES-GCM ciphertext + authentication tag`.
- **Inline encryption** embeds the Base64 payload directly in the note using markers — `%%🔐β <payload>` (hidden in source) or the visible `🔐β <payload>`, plus the newer `encrypt(visible text){<payload>}` format. The version is detected from the marker at decryption time, and legacy `🔐α` / `🔐` markers are still supported.

### Security assessment

- The default scheme (v2) is a mainstream, sound construction: PBKDF2-SHA512 with 210k iterations, a random per-message salt, and a random IV under AES-256-GCM.
- Legacy v0 has a critical weakness — a fixed IV combined with an unsalted key — and v1 uses a hardcoded salt with only 1,000 iterations. Both exist solely to decrypt historical data and are never used to produce new ciphertext.

---

## Installation

### Option A — BRAT (recommended for testing)
1. Install the **BRAT** plugin from the community store.
2. `Ctrl/Cmd+P` → *BRAT: Add a beta plugin*.
3. Paste the repository URL: `https://github.com/hellokunzai/obsidian-vault-encrypted`.
4. Enable **Vault Encrypted** in Community plugins.

### Option B — Manual
1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/hellokunzai/obsidian-vault-encrypted/releases).
2. Copy them into `<vault>/.obsidian/plugins/vault-encrypted/`.
3. Enable **Vault Encrypted** in **Settings → Community plugins**.

> After updating, reload with `Ctrl/Cmd+P` → *Reload app without saving* so the new `main.js` and `styles.css` take effect.

---

## Commands

| Command | Id | Description |
| --- | --- | --- |
| Create new encrypted note | `meld-encrypt-create-new-note` | Create a new fully encrypted note |
| Convert to or from an Encrypted note | `meld-encrypt-convert-to-or-from-encrypted-note` | Encrypt/decrypt the active note as a whole |
| Encrypt Selection | `meld-encrypt-in-place-encrypt` | Encrypt the selected text inline |
| Decrypt | `meld-encrypt-in-place-decrypt` | Decrypt the selected / cursor block inline |
| Encrypt folder of current note | `meld-encrypt-folder-encrypt` | Bulk-encrypt the current note's folder |
| Decrypt folder of current note | `meld-encrypt-folder-decrypt` | Bulk-decrypt the current note's folder |
| Mark / unmark folder of current note | `meld-encrypt-toggle-mark-folder` | Flag / unflag the current note's folder as encrypted (auto-encrypt new notes) |
| Generate Random Password | `meld-encrypt-generate-password` | Open the random password generator |
| Clear Session Password Cache | `meld-encrypt-clear-password-cache` | Clear cached passwords for this session |
| Lock and Close all open encrypted notes | `meld-encrypt-close-and-forget` | Lock every open encrypted note |

---

## Settings

| Setting | Description |
| --- | --- |
| **Confirm password?** | When enabled, encrypt operations ask you to type the password twice. |
| **Remember password?** | Cache the last used password so you don't retype it. |
| **Remember Password** | Shows the current cache lifetime and a slider (0–120 minutes). `0` means the cache is cleared when Obsidian closes. |
| **Inline encryption → Expand selection to whole line?** | Partial selections are expanded to the full line before encrypting. |
| **Inline encryption → Search limit for markers** | How far to look for markers when encrypting/decrypting. |
| **Inline encryption → By default, show encrypted marker when reading** | Whether inline encryption leaves a visible marker in Reading view. |
| **Generate random password → Default length** | Default character count for generated passwords. |
| **Generate random password → Include uppercase (A–Z)** | Include uppercase letters in generated passwords. |
| **Generate random password → Include lowercase (a–z)** | Include lowercase letters in generated passwords. |
| **Generate random password → Include numbers (0–9)** | Include digits in generated passwords. |
| **Generate random password → Include symbols (!@#$...)** | Include symbols in generated passwords. |
| **Folder encryption → Recursive by default** | Include sub-folders when the folder dialog opens. |

---

## Security Notes

- Encryption is performed locally; no data leaves your device.
- There is **no password recovery**. Store your passwords safely.
- The plugin relies on the Obsidian/Electron crypto primitives; it has not been independently audited.

---

## License

[MIT](./LICENSE) © hellokunzai
