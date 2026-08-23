import MeldEncrypt from "../../main.ts";
import { t } from "../../i18n";
import { IMeldEncryptPluginSettings } from "../../settings/MeldEncryptPluginSettings.ts";
import { IMeldEncryptPluginFeature } from "../IMeldEncryptPluginFeature.ts";
import { Notice, TFile, TextFileView } from "obsidian";
import PluginPasswordModal from "../../PluginPasswordModal.ts";
import { PasswordAndHint, SessionPasswordService } from "../../services/SessionPasswordService.ts";
import { JsonFileEncoding } from "../../services/FileDataHelper.ts";
import { ENCRYPTED_FILE_EXTENSIONS, ENCRYPTED_FILE_EXTENSION_DEFAULT } from "../../services/Constants.ts";
import { FileEncryptHelper } from "../../services/FileEncryptHelper.ts";

export default class FeatureConvertNote implements IMeldEncryptPluginFeature {
	
	plugin: MeldEncrypt;
	
	async onload(plugin: MeldEncrypt, settings: IMeldEncryptPluginSettings) {
		this.plugin = plugin;

		this.plugin.addCommand({
			id: 'meld-encrypt-convert-to-or-from-encrypted-note',
			name: t("command.convert"),
			icon: 'file-lock-2',
			checkCallback: (checking) => this.processCommandConvertActiveNote( checking ),
		});

		this.plugin.registerEvent(
			this.plugin.app.workspace.on( 'file-menu', (menu, file) => {
				if (file instanceof TFile){
					if ( file.extension == 'md' ){
						menu.addItem( (item) => {
							item
								.setTitle(t("menu.encryptNote"))
								.setIcon('file-lock-2')
								.onClick( () => this.processCommandEncryptNote( file ) );
							}
						);
					}
					if ( ENCRYPTED_FILE_EXTENSIONS.contains( file.extension ) ){
						menu.addItem( (item) => {
							item
								.setTitle(t("menu.decryptNote"))
								.setIcon('file')
								.onClick( () => this.processCommandDecryptNote( file ) );
							}
						);
					}
				}
			})
		);

	}
	
	onunload(): void { }

	buildSettingsUi(containerEl: HTMLElement, saveSettingCallback: () => Promise<void>): void { }

	private checkCanEncryptFile( file:TFile | null ) : boolean {
		if ( file == null ){
			return false;
		}
		return file.extension == 'md';
	}

	private checkCanDecryptFile( file:TFile | null ) : boolean {
		if ( file == null ){
			return false;
		}
		return ENCRYPTED_FILE_EXTENSIONS.contains( file.extension );
	}

	private processCommandEncryptNote( file:TFile ){
		this.getPasswordAndEncryptFile( file ).catch( reason => {
			if (reason){
				new Notice(reason, 10000);
			}
		});
	}

	private processCommandDecryptNote( file:TFile ){
		this.getPasswordAndDecryptFile( file ).catch( reason => {
			if (reason){
				new Notice(reason, 10000);
			}
		});
	}

	private processCommandConvertActiveNote( checking: boolean ) : boolean | void {
		const file = this.plugin.app.workspace.getActiveFile();
		
		if (checking){
			return this.checkCanEncryptFile(file)
				|| this.checkCanDecryptFile(file)
			;
		}

		if ( file?.extension == 'md' ){
			this.getPasswordAndEncryptFile( file ).catch( reason => {
				if (reason){
					new Notice(reason, 10000);
				}
			});
		}

		if ( file && ENCRYPTED_FILE_EXTENSIONS.contains( file.extension ) ){
			this.getPasswordAndDecryptFile( file ).catch( reason => {
				if (reason){
					new Notice(reason, 10000);
				}
			});
		}
	}

	private async getPasswordAndEncryptFile( file:TFile ) {

		if ( !this.checkCanEncryptFile(file) ) {
			throw new Error( t("error.unableToEncryptFile") );
		}

		try{

			// try to get password from session password service
			let password = await SessionPasswordService.getByFile( file );

			if ( password.password == '' ){
				// ask for password
				const pm = new PluginPasswordModal( this.plugin.app, t("modal.encryptNoteTitle"), true, true, password );
				password = await pm.openAsync();
			}

			const encryptedFileContent = await FileEncryptHelper.encryptFile(this.plugin, file, password);

			await FileEncryptHelper.closeUpdateRememberPasswordThenReopen(
				this.plugin,
				file,
				ENCRYPTED_FILE_EXTENSION_DEFAULT,
				encryptedFileContent,
				password
			);
			
			new Notice( t("notice.noteEncrypted") );

		}catch( error ){
			if (error){
				new Notice(error, 10000);
			}
		}
	}

	private async getPasswordAndDecryptFile( file:TFile ) {
		if ( !this.checkCanDecryptFile(file) ) {
			throw new Error( t("error.unableToDecryptFile") );
		}

		let passwordAndHint = await SessionPasswordService.getByFile( file );
		if ( passwordAndHint.password != '' ){
			// try to decrypt using saved password
			const decryptedContent = await FileEncryptHelper.decryptFile( this.plugin, file, passwordAndHint.password );
			if (decryptedContent != null){
				// update file
				await FileEncryptHelper.closeUpdateRememberPasswordThenReopen( this.plugin, file, 'md', decryptedContent, passwordAndHint );
				return;
			}
		}
		
		// fetch from user
		const encryptedFileContent = await this.plugin.app.vault.read( file );
		const encryptedData = JsonFileEncoding.decode( encryptedFileContent );


		const pwm = new PluginPasswordModal(this.plugin.app, t("modal.decryptNoteTitle"), false, false, { password: '', hint: encryptedData.hint } );
		try{
			passwordAndHint = await pwm.openAsync();
			
			if (!pwm.resultConfirmed){
				return;
			}
			
			const content = await FileEncryptHelper.decryptFile( this.plugin, file, passwordAndHint.password );
			if ( content == null ){
				throw new Error(t("error.decryptionFailed"));
			}

			await FileEncryptHelper.closeUpdateRememberPasswordThenReopen( this.plugin, file, 'md', content, passwordAndHint );

			new Notice( t("notice.noteDecrypted") );

		}catch(error){
			if (error){
				new Notice(error, 10000);
			}
		}
	}
}