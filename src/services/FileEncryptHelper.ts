import MeldEncrypt from "../main.ts";
import { TFile, TextFileView } from "obsidian";
import { PasswordAndHint, SessionPasswordService } from "./SessionPasswordService.ts";
import { FileDataHelper, JsonFileEncoding } from "./FileDataHelper.ts";
import { Utils } from "./Utils.ts";
import { ENCRYPTED_FILE_EXTENSION_DEFAULT } from "./Constants.ts";
import { EncryptedMarkdownView } from "../features/feature-whole-note-encrypt/EncryptedMarkdownView.ts";

/**
 * Shared single-file encrypt/decrypt primitives reused by both the
 * single-note convert feature and the folder-bulk feature.
 */
export class FileEncryptHelper {

	/**
	 * Encrypt a plain .md file, returning the encoded encrypted file content.
	 */
	static async encryptFile(plugin: MeldEncrypt, file: TFile, passwordAndHint: PasswordAndHint): Promise<string> {
		const content = await plugin.app.vault.read(file);
		const encryptedData = await FileDataHelper.encrypt(passwordAndHint.password, passwordAndHint.hint, content);
		return JsonFileEncoding.encode(encryptedData);
	}

	/**
	 * Decrypt an encrypted file. Returns null when the password is wrong.
	 */
	static async decryptFile(plugin: MeldEncrypt, file: TFile, password: string): Promise<string | null> {
		const encryptedFileContent = await plugin.app.vault.read(file);
		const encryptedData = JsonFileEncoding.decode(encryptedFileContent);
		return await FileDataHelper.decrypt(encryptedData, password);
	}

	/**
	 * Rename the file to the target extension, write the new content, and
	 * remember the password for the (new) file. Reopens the file if it was open.
	 */
	static async closeUpdateRememberPasswordThenReopen(
		plugin: MeldEncrypt,
		file: TFile,
		newFileExtension: string,
		content: string,
		pw: PasswordAndHint
	): Promise<void> {
		let didDetach = false;

		plugin.app.workspace.iterateAllLeaves(l => {
			if (l.view instanceof TextFileView && l.view.file == file) {
				if (l.view instanceof EncryptedMarkdownView) {
					l.view.detachSafely();
				} else {
					l.detach();
				}
				didDetach = true;
			}
		});

		try {
			const newFilepath = Utils.getFilePathWithNewExtension(file, newFileExtension);
			await plugin.app.fileManager.renameFile(file, newFilepath);
			await plugin.app.vault.modify(file, content);
			SessionPasswordService.putByFile(pw, file);
		} finally {
			if (didDetach) {
				await plugin.app.workspace.getLeaf(true).openFile(file);
			}
		}
	}

	/**
	 * Determine the effective encrypted extension for a freshly encrypted file.
	 */
	static get defaultEncryptedExtension(): string {
		return ENCRYPTED_FILE_EXTENSION_DEFAULT;
	}
}
