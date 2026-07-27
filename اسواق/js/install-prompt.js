let deferredPrompt;
const installBtn = document.getElementById('installBtn') || document.getElementById('installAppBtn');

// 1. الاستماع لحدث جاهزية التثبيت من المتصفح
window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredPrompt = e;
  
  // إظهار زر التثبيت إذا كان موجوداً في الصفحة
  if (installBtn) {
    installBtn.style.display = 'inline-block';
  }
});

// 2. عند الضغط على زر التثبيت
if (installBtn) {
  installBtn.addEventListener('click', async () => {
    if (!deferredPrompt) return;
    
    // إظهار نافذة التثبيت الرسمية للمستخدم
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    
    console.log(`استجابة المستخدم لطلب التثبيت: ${outcome}`);
    deferredPrompt = null;
    installBtn.style.display = 'none';
  });
}

// 3. التخفي التلقائي للزر إذا تم تثبيت التطبيق بنجاح
window.addEventListener('appinstalled', () => {
  console.log('تم تثبيت تطبيق تراكم بنجاح!');
  if (installBtn) installBtn.style.display = 'none';
});

// 4. تسجيل الـ Service Worker بالمسار النسبي المضبوط
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((reg) => console.log('Service Worker Registered Successfully!', reg))
      .catch((err) => console.error('Service Worker Registration Failed!', err));
  });
}