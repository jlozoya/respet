`icon.svg` is the source of truth for the default Social Network icon. Run
`npm run icons` from `apps/mobile` to regenerate the web favicon, legacy app
assets, and all Android/iOS icon sizes.

`splash.png` and the platform-specific splash images remain legacy Cordova
resources; Capacitor currently hides the native splash immediately.
