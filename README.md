# Lozoya

Esta es una aplicación para dedicada al comercio electrónico basado en la web y el uso de mobles.

Puedes encontrar la documentación de este api [aquí](https://lozoya.biz/respet-api-docs/), y un ejemplo de la interfaz relacionada [aquí](https://lozoya.biz/respet).

## Tabla de contenido

1. [Empezando](#getting-started)
2. [Páginas](#pages)
3. [Librerias, proveedores y dependencias](#libraries_suppliers_dependencies)
4. [i18n](#i18n)
  * [Agregando idiomas](#adding_languages)
  * [Cambiando idiomas](#changing_the_language)
5. [Credenciales](#credentials)
6. [Lanzamiento](#lanzamiento)
  * [Android](#android)
  * [Navegador](#browser)
7. [Google services](#google_services)
  * [Google login](#google_login)
8. [Facebook services](#facebook_services)
9. [Typedoc](#typedoc)

## <a name="getting-started"></a>Empezando

Para probas esta aplicación es necesario instalar sus dependencias y ejecutarla:

```bash
npm install
ionic serve
```

## <a name="pages"></a>Páginas

La aplicación viene con una variedad de páginas listas para usar. Estas páginas ayudan
usted a ensamblar bloques de construcción comunes para su aplicación para que pueda enfocarse en su
características únicas y marca.

La aplicación abre primero en la pagina `TutorialPage`. Si el usuario ya ha pasado por esta página una vez,
se saltará la siguiente vez que cargan la aplicación.

Una vez que el usuario es autenticado, la aplicación cargará con el `MainPage` que es
configurado para ser el `TabsPage` como el predeterminado.

## <a name="libraries_suppliers_dependencies"></a>Librerias, proveedores y dependencias

La aplicación tiene instalado diversas dependencias e implementa algunos proveedores.

```bash
ionic cordova plugin add cordova-plugin-camera --save

ionic cordova plugin add cordova-plugin-file-transfer --save
ionic cordova plugin add cordova-plugin-file --save

ionic cordova plugin add cordova-plugin-filepath --save

npm install --save @ionic-native/camera @ionic-native/file @ionic-native/file-path @ionic-native/transfer

npm install --save @ionic-native/file-transfer

npm install --save @ionic-native/facebook

cordova plugin add cordova-plugin-facebook4 --save --variable APP_ID="xxxxxxxxxxx" --variable APP_NAME="Lozoya" --variable FACEBOOK_ANDROID_SDK_VERSION="4.36.1"

npm install --save @ionic-native/google-plus

ionic cordova plugin add cordova-plugin-googleplus --variable REVERSED_CLIENT_ID="com.googleusercontent.apps.xxxxx" --variable WEB_APPLICATION_CLIENT_ID="xxxxxx.apps.googleusercontent.com"

ionic cordova plugin remove ionic-plugin-deeplinks --variable URL_SCHEME=Lozoya --variable DEEPLINK_SCHEME=https --variable DEEPLINK_HOST=lozoya.com --variable ANDROID_PATH_PREFIX=/

npm install --save @ionic-native/deeplinks

npm install chart.js --save

ionic cordova plugin add cordova-plugin-crop
npm install --save @ionic-native/crop
npm install ngx-image-cropper --save

ionic cordova plugin add cordova-plugin-bluetooth-serial2
npm install --save @ionic-native/bluetooth-serial

npm install --save rxjs-compat

ionic cordova plugin add cordova-sqlite-storage
npm install --save @ionic-native/sqlite

ionic cordova plugin add phonegap-plugin-push --variable SENDER_ID=xxxxx --variable FCM_VERSION=11.8.0

npm install --save @ionic-native/push

ionic cordova plugin add ionic-plugin-deeplinks --variable URL_SCHEME=Lozoya --variable DEEPLINK_SCHEME=https --variable DEEPLINK_HOST=lozoya.com --variable ANDROID_PATH_PREFIX=//
```

## <a name="i18n"></a>i18n

La aplicación viene con internacionalización (i18n) fuera de la caja con
[ngx-translate](https://github.com/ngx-translate/core). Esto hace que sea fácil
cambie el texto utilizado en la aplicación modificando solo un archivo.

### <a name="adding_languages"></a>Agregando idiomas

Para agregar nuevos idiomas, agregue nuevos archivos al directorio `src/assets/i18n`,
siguiendo el patrón de LANGCODE.json donde LANGCODE es el idioma/locale
código (ej .: en/gb/de/es/etc.).

### <a name="changing_the_language"></a>Cambiando idiomas

Para cambiar el idioma de la aplicación, edite `src/app/app.component.ts` y modifique
`translate.use('es')` para usar LANGCODE desde `src/assets/i18n/`

## <a name="lanzamiento"></a>Lanzamiento

### <a name="android"></a>Android

```bash
ionic cordova build android --release
## Solo una vez
keytool -genkey -v -keystore respet.keystore -alias respet -keyalg RSA -keysize 2048 -validity 10000
## cd /platforms/android/app/build/outputs/apk/release
## tiene la misma contraseña de la cuenta de google
jarsigner -verbose -sigalg SHA1withRSA -digestalg SHA1 -keystore ../../../../../../../respet.keystore app-release-unsigned.apk respet

zipalign -v 4 app-release-unsigned.apk respet.apk
```

Generar SH1

```bash
keytool -J-Duser.language=en -exportcert -alias respet -keystore ../../../../../../respet.keystore -list -v -storepass qwertyui
```

Para hacer debug

```bash
adb logcat chromium:D GooglePlugin:V *:S
```

### <a name="browser"></a>Navegador

Es importante reemplazar esto:

```xml
<preference name="SplashScreen" value="screen" />
```

En el archivo config.xml

```xml
<preference name="SplashScreen" value="assets/imgs/appicon.png" />
```

Ejecutar: 

```bash
ionic cordova build browser --prod
# or
npm run build --prod -- --base-href "./"
```

Asegurarse que la variable `gcm_sender_id` sea igual a "103953800507"

## <a name="google_services"></a>Google services

En el archivo `platforms/android/project.properties` asegúrate de que las siguientes dependencias estén así:

```java
cordova.system.library.4=com.google.android.gms:play-services-auth:11.8.0
cordova.system.library.5=com.google.android.gms:play-services-identity:11.8.0
```

En caso de marque un error por un signo "+"

Se pide el archivo google-services.json, arrástralo de la raíz a `platforms/android`

Para obtener la clave SHA1

```bash
keytool -J-Duser.language=en -exportcert -alias respet -keystore respet.keystore -list -v -storepass fs227sca2
keytool -J-Duser.language=en -exportcert -keystore debug.keystore -list -v -alias androiddebugkey -storepass android -keypass android
```

### <a name="google_login"></a>[Google login](https://www.joshmorony.com/implementing-google-plus-sign-in-with-oauth-2-0-in-ionic-2/)

Agregar api para login con ios:

https://developers.google.com/mobile/add?platform=ios&cntapi=signin

Agregar api para login con android:

- Obtener la clabe SHA1
keytool -exportcert -list -v -alias respet -keystore respet.keystore

https://developers.google.com/mobile/add?platform=android&cntapi=signin

## <a name="facebook_services"></a>[Facebook services](https://developers.facebook.com/)

Clave api de facebook:

keytool -exportcert -alias respet -keystore respet.keystore | openssl sha1 -binary | openssl base64

APP_ID
* xxxxxxxxxxx

APP_NAME
* Lozoya

## <a name="typedoc"></a>[Typedoc](https://typedoc.org/)

Para generar los archivos de documentación:

```bash
npm install --global typedoc

typedoc --options typedoc.json
```
