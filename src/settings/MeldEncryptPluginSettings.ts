import { IFeatureInplaceEncryptSettings } from "../features/feature-inplace-encrypt/IFeatureInplaceEncryptSettings.ts";
import { IFeatureWholeNoteEncryptSettings } from "../features/feature-whole-note-encrypt/IFeatureWholeNoteEncryptSettings.ts";
import { IFeatureRandomPasswordSettings } from "../features/feature-random-password/IFeatureRandomPasswordSettings.ts";
import { IFeatureFolderEncryptSettings } from "../features/feature-folder-encrypt/IFeatureFolderEncryptSettings.ts";

export interface IMeldEncryptPluginSettings {
	confirmPassword: boolean;
	rememberPassword: boolean;
	rememberPasswordTimeout: number;

	featureWholeNoteEncrypt : IFeatureWholeNoteEncryptSettings;
	featureInplaceEncrypt : IFeatureInplaceEncryptSettings;
	featureRandomPassword : IFeatureRandomPasswordSettings;
	featureFolderEncrypt : IFeatureFolderEncryptSettings;
}

