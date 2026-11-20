# TOBU Çiğ Köfte — Sipariş ve Masa Yönetimi

TOBU için web arayüzü ve Windows masaüstü uygulaması olarak çalışacak satış/sipariş yönetim sistemi.

## Teknoloji yaklaşımı
- React + TypeScript + Vite: ortak web arayüzü
- Electron: Windows masaüstü paketi
- İlk prototip: tarayıcı yerel depolaması (LocalStorage)
- Sonraki aşama: merkezi veritabanı, kullanıcı/rol yönetimi ve cihazlar arası senkronizasyon

## Modüller
- Yönetici girişi
- Masa yönetimi (masa ekleme/çıkarma)
- Masaya sipariş ekleme ve sepet yönetimi
- Ayaküstü satış
- Kategori ve ürün yönetimi
- Ödeme, satış geçmişi ve günlük/aylık raporlar
- Takvim bazlı geçmiş kayıtlar

## Geliştirme
```bash
npm install
npm run dev
```

## Windows
```bash
npm run desktop:dev
npm run desktop:build
```

> Güvenlik notu: İlk prototipteki yerel yönetici hesabı yalnızca geliştirme amaçlıdır. Gerçek işletme kullanımından önce sunucu taraflı kimlik doğrulama, güvenli parola saklama, veritabanı yedeklemesi ve yetkilendirme kurulmalıdır.
