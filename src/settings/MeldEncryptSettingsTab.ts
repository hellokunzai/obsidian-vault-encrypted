import { App, Notice, PluginSettingTab, Setting } from "obsidian";
import { t } from "../i18n";
import { IMeldEncryptPluginFeature } from "../features/IMeldEncryptPluginFeature.ts";
import { SessionPasswordService } from "../services/SessionPasswordService.ts";
import MeldEncrypt from "../main.ts";
import { IMeldEncryptPluginSettings } from "./MeldEncryptPluginSettings.ts";

export default class MeldEncryptSettingsTab extends PluginSettingTab {
	plugin: MeldEncrypt;
	settings: IMeldEncryptPluginSettings;

	features:IMeldEncryptPluginFeature[];

	constructor(
		app: App,
		plugin: MeldEncrypt,
		settings:IMeldEncryptPluginSettings,
		features: IMeldEncryptPluginFeature[]
	) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = settings;
		this.features = features;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		
		new Setting(containerEl)
			.setName(t("settings.confirmPassword.name"))
			.setDesc(t("settings.confirmPassword.desc"))
			.addToggle( toggle =>{
				toggle
					.setValue(this.settings.confirmPassword)
					.onChange( async value =>{
						this.settings.confirmPassword = value;
						await this.plugin.saveSettings();
					})
			})
		;

		const updateRememberPasswordSettingsUi = () => {
			
			if ( !this.settings.rememberPassword ){
				pwTimeoutSetting.settingEl.hide();
				rememberPasswordLevelSetting.settingEl.hide();
				return;
			}

			if ( this.settings.rememberPasswordLevel != SessionPasswordService.LevelExternalFile ){
				pwTimeoutSetting.settingEl.show();
				extFilePathsSetting.settingEl.hide();
			}else{
				pwTimeoutSetting.settingEl.hide();
				extFilePathsSetting.settingEl.show();
			}

			rememberPasswordLevelSetting.settingEl.show();

			const rememberPasswordTimeout = this.settings.rememberPasswordTimeout;

			let timeoutString = t("settings.rememberPasswordTimeout.forMinutes", { minutes: rememberPasswordTimeout.toString() });
			if( rememberPasswordTimeout == 0 ){
				timeoutString = t("settings.rememberPasswordTimeout.untilClosed");
			}

			pwTimeoutSetting.setName( t("settings.rememberPasswordTimeout.name", { timeout: timeoutString }) )
		
		}

		new Setting(containerEl)
			.setName(t("settings.rememberPassword.name"))
			.setDesc(t("settings.rememberPassword.desc"))
			.addToggle( toggle =>{
				toggle
					.setValue(this.settings.rememberPassword)
					.onChange( async value => {
						this.settings.rememberPassword = value;
						await this.plugin.saveSettings();
						SessionPasswordService.setActive( this.settings.rememberPassword );
						updateRememberPasswordSettingsUi();
					})
			})
		;

		const rememberPasswordLevelSetting = new Setting(containerEl)
			.setName(t("settings.rememberPasswordsBy"))
			.setDesc( this.buildRememberPasswordDescription() )
			.addDropdown( cb =>{
				cb
				.addOption( SessionPasswordService.LevelVault, t("dropdown.vault"))
				.addOption( SessionPasswordService.LevelParentPath, t("dropdown.folder"))
				.addOption( SessionPasswordService.LevelFilename, t("dropdown.file"))
				.addOption( SessionPasswordService.LevelExternalFile, t("dropdown.externalFile"))
					.setValue( this.settings.rememberPasswordLevel )
					.onChange( async value => {
						console.debug( 'rememberPasswordLevelSetting.onChange', { value } );
						this.settings.rememberPasswordLevel = value;
						await this.plugin.saveSettings();
						SessionPasswordService.setLevel( this.settings.rememberPasswordLevel );
						updateRememberPasswordSettingsUi();
					})
				;
			})
		;

		
		const pwTimeoutSetting = new Setting(containerEl)
			.setDesc(t("settings.rememberPasswordTimeout.desc"))
			.addSlider( slider => {
				slider
					.setLimits(0, 120, 5)
					.setValue(this.settings.rememberPasswordTimeout)
					.onChange( async value => {
						this.settings.rememberPasswordTimeout = value;
						await this.plugin.saveSettings();
						SessionPasswordService.setAutoExpire( this.settings.rememberPasswordTimeout );
						updateRememberPasswordSettingsUi();
					})
				;
				
			})
		;

		const extFilePathsSetting = new Setting(containerEl)
			.setName( t("settings.externalFilePaths.name") )
			.setDesc( t("settings.externalFilePaths.desc") )
			.addTextArea( text => {
				text
					.setValue( this.settings.rememberPasswordExternalFilePaths.join( '\n' ) )
					.onChange( async value => {
						this.settings.rememberPasswordExternalFilePaths = value.trim().split( '\n' );
						await this.plugin.saveSettings();
						SessionPasswordService.setExternalFilePaths( this.settings.rememberPasswordExternalFilePaths );
					})
				;
				text.inputEl.placeholder = t("settings.externalFilePaths.placeholder");
				text.inputEl.style.whiteSpace = 'pre';
				text.inputEl.style.width = '100%';
				text.inputEl.rows = 4;
			})
			.addButton( btn => {
				btn
					.setIcon( 'check' )
					.setTooltip( t("settings.externalFilePaths.checkPaths") )
					.onClick( async () => {
						const filePaths = this.settings.rememberPasswordExternalFilePaths;
						for( const filePath of filePaths ){
							if (await SessionPasswordService.canFetchContents( filePath ) ){
								new Notice( t("notice.pathOk", { path: filePath }) );
							}else{
								new Notice( t("notice.pathFail", { path: filePath }) );
							}
							
						}
					})
				;
			})
		;
		extFilePathsSetting.controlEl.style.width = '80%';

		updateRememberPasswordSettingsUi();

		// build feature settings
		this.features.forEach(f => {
			f.buildSettingsUi( containerEl, async () => await this.plugin.saveSettings() );
		});
		
	}

	private buildRememberPasswordDescription( ) : DocumentFragment {
		const f = new DocumentFragment();

		const tbody = f.createEl( 'table' ).createTBody();

		
		let tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: t("dropdown.vault") + ':', attr: { 'align': 'right'} });
		tr.createEl( 'td', { text: t("settings.rememberPasswordsBy.descVault") });
		
		tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: t("dropdown.folder") + ':', attr: { 'align': 'right'} });
		tr.createEl( 'td', { text: t("settings.rememberPasswordsBy.descFolder") });
		
		tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: t("dropdown.file") + ':', attr: { 'align': 'right'} });
		tr.createEl( 'td', { text: t("settings.rememberPasswordsBy.descFile") });
		
		tr = tbody.createEl( 'tr' );
		tr.createEl( 'th', { text: t("dropdown.externalFile") + ':', attr: { 'align': 'right', 'style': 'width:12em;'} });
		tr.createEl( 'td', { text: t("settings.rememberPasswordsBy.descExternalFile") });

		return f;
	}

}