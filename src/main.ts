import { Notice, Plugin } from 'obsidian';
import { t } from './i18n';
import MeldEncryptSettingsTab from './settings/MeldEncryptSettingsTab.ts';
import { IMeldEncryptPluginSettings } from './settings/MeldEncryptPluginSettings.ts';
import { IMeldEncryptPluginFeature } from './features/IMeldEncryptPluginFeature.ts';
import { SessionPasswordService } from './services/SessionPasswordService.ts';
import FeatureInplaceEncrypt from './features/feature-inplace-encrypt/FeatureInplaceEncrypt.ts';
import FeatureConvertNote from './features/feature-convert-note/FeatureConvertNote.ts';
import FeatureWholeNoteEncryptV2 from './features/feature-whole-note-encrypt/FeatureWholeNoteEncrypt.ts';
import FeatureRandomPassword from './features/feature-random-password/FeatureRandomPassword.ts';
import FeatureFolderEncrypt from './features/feature-folder-encrypt/FeatureFolderEncrypt.ts';

export default class MeldEncrypt extends Plugin {

	private settings: IMeldEncryptPluginSettings;

	/** Public read access to settings (used by feature modules). */
	get pluginSettings(): IMeldEncryptPluginSettings {
		return this.settings;
	}

	private enabledFeatures : IMeldEncryptPluginFeature[] = [];

	async onload() {
		
		SessionPasswordService.init(this.app.vault.adapter);

		// Settings
		await this.loadSettings();

		this.enabledFeatures.push(
			new FeatureWholeNoteEncryptV2(),
			new FeatureConvertNote(),
			new FeatureInplaceEncrypt(),
			new FeatureFolderEncrypt(),
			new FeatureRandomPassword(),
		);

		this.addSettingTab(
			new MeldEncryptSettingsTab(
				this.app,
				this,
				this.settings,
				this.enabledFeatures
			)
		);
		// End Settings

		this.addCommand({
			id: 'meld-encrypt-clear-password-cache',
			name: t("command.clearPasswordCache"),
			icon: 'shield-ellipsis',
			callback: () => {
				const itemsCleared = SessionPasswordService.clear();
				new Notice( t("notice.itemsCleared", { count: itemsCleared.toString() }) );
			},
		});

		// load features
		this.enabledFeatures.forEach(async f => {
			await f.onload( this, this.settings );
		});

	}
	
	override onunload() {
		this.enabledFeatures.forEach(async f => {
			f.onunload();
		});
		super.onunload();
	}

	async loadSettings() {
		
		const DEFAULT_SETTINGS: IMeldEncryptPluginSettings = {
			confirmPassword: true,
			rememberPassword: true,
			rememberPasswordTimeout: 30,
			rememberPasswordLevel: SessionPasswordService.LevelVault,
			rememberPasswordExternalFilePaths: [],

			featureWholeNoteEncrypt: {
			},
			
			featureInplaceEncrypt:{
				expandToWholeLines: false,
				markerSearchLimit: 10000,
				showMarkerWhenReadingDefault: true
			},

			featureRandomPassword: {
				length: 16,
				upper: true,
				lower: true,
				number: true,
				symbol: true
			},

			featureFolderEncrypt: {
				recursive: true
			}
		}

		this.settings = Object.assign(
			DEFAULT_SETTINGS,
			await this.loadData()
		);

		// apply settings
		SessionPasswordService.setActive( this.settings.rememberPassword );
		SessionPasswordService.setAutoExpire(
			this.settings.rememberPasswordTimeout == 0
			? null
			: this.settings.rememberPasswordTimeout
		);
		SessionPasswordService.setLevel( this.settings.rememberPasswordLevel );
		SessionPasswordService.setExternalFilePaths( this.settings.rememberPasswordExternalFilePaths );
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}