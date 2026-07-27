const CACHE_NAME = 'tarakum-v2';

// الأصول والملفات المطلوب تخزينها مؤقتاً للعمل بدون إنترنت
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './android/launchericon-192x192.png',
  './android/launchericon-512x512.png'
];

// 1. تثبيت الـ Service Worker وتخزين الأصول الأساسية
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('تم فتح الكاش وتخزين الملفات بنجاح');
      return cache.addAll(ASSETS_TO_CACHE);
    }).then(() => self.skipWaiting())
  );
});

// 2. تفعيل الـ Service Worker وحذف الكاش القديم إن وجد
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cache) => {
          if (cache !== CACHE_NAME) {
            console.log('حذف الكاش القديم:', cache);
            return caches.delete(cache);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// 3. الاستجابة للطلبات أثناء الاتصال أو بدون إنترنت (Cache First Strategy)
self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => {
      // إرجاع الملف من الكاش إن وجد، أو جلب الملف من الشبكة
      return response || fetch(event.request).catch(() => {
        // إذا كان الطلب يتجه لصفحة ويب ولم يتوفر إنترنت، يتم إرجاع الصفحة الرئيسية
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});