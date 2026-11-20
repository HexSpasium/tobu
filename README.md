# TOBU POS

TOBU merkezi sipariş, satış ve şube yönetim platformu.

## Platform paketleri
- **Web:** Vercel üzerinde çalışan ortak React/Vite uygulaması.
- **Windows:** Electron ile kurulum sihirbazlı NSIS `.exe`; x64 ve ARM64 paketleri.
- **Android:** Capacitor tabanlı Android uygulaması; CI üzerinden APK üretimi.
- **Ortak marka:** `public/tobu.svg` Windows ve Android ikonlarının tek kaynak tasarımıdır.

## Yerel geliştirme
```bash
npm install
npm run dev
```

## Windows kurulum paketi
Windows üzerinde:
```bash
npm install
npm run build
node scripts/generate-icons.mjs
npx electron-builder --win nsis --x64
```
ARM64 için `--arm64` kullanın. Kurulum dosyası `release/` klasörüne çıkar.

## Android APK
Android Studio, Android SDK ve JDK 21 kurulu ortamda:
```bash
npm install
npm run build
node scripts/generate-icons.mjs
npx cap add android
npx cap sync android
npx capacitor-assets generate --android
cd android
./gradlew assembleDebug
```
APK: `android/app/build/outputs/apk/debug/app-debug.apk`

## GitHub Actions
Actions sekmesinden **Build TOBU Windows Installer** ve **Build TOBU Android APK** iş akışlarını çalıştırın. Oluşan kurulum dosyaları ve APK, ilgili çalıştırmanın **Artifacts** bölümünde indirmeye hazır olur.

Windows paketi Windows 10/11 x64 ve ARM64 hedeflidir. Android APK Android 7.0+ cihazları hedefleyen Capacitor/Android WebView tabanlıdır.

> İlk Android paketi debug imzalı APK olarak üretilir. Play Store veya kurumsal dağıtım için ayrıca release keystore ile imzalama yapılandırılmalıdır.
