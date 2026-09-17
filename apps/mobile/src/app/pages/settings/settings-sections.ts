/** Un apartado de la configuración. */
export interface SettingsSection {
  link: string;
  title: string;
  hint: string;
  icon: string;
}

/** Los apartados, en el orden de «Configuración y privacidad» de Facebook. */
export const SETTINGS_SECTIONS: readonly SettingsSection[] = [
  { link: '/settings/profile', title: 'SETTINGS.PROFILE', hint: 'SETTINGS.PROFILE_HINT', icon: 'person-circle-outline' },
  { link: '/settings/account', title: 'SETTINGS.ACCOUNT', hint: 'SETTINGS.ACCOUNT_HINT', icon: 'id-card-outline' },
  { link: '/settings/security', title: 'SETTINGS.SECURITY', hint: 'SETTINGS.SECURITY_HINT', icon: 'shield-checkmark-outline' },
  { link: '/settings/privacy', title: 'SETTINGS.PRIVACY', hint: 'SETTINGS.PRIVACY_HINT', icon: 'lock-closed-outline' },
  { link: '/settings/apps', title: 'SETTINGS.APPS', hint: 'SETTINGS.APPS_HINT', icon: 'apps-outline' },
  { link: '/settings/blocked', title: 'SETTINGS.BLOCKED', hint: 'SETTINGS.BLOCKED_HINT', icon: 'ban-outline' },
  { link: '/settings/preferences', title: 'SETTINGS.PREFERENCES', hint: 'SETTINGS.PREFERENCES_HINT', icon: 'color-palette-outline' },
];
