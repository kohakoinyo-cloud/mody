// ==========================================
// 1. تسجيل الـ Service Worker للعمل أوفلاين
// ==========================================
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then(reg => console.log('SW Registered:', reg.scope))
      .catch(err => console.error('SW Error:', err));
  });
}

// ==========================================
// 2. إدارة حالة البيانات والنظام
// ==========================================
let customers = JSON.parse(localStorage.getItem('myStore_customers')) || [];
let stock = JSON.parse(localStorage.getItem('myStore_stock')) || [];
let sales = JSON.parse(localStorage.getItem('myStore_sales')) || [];

let html5QrcodeScanner = null;
let deferredPrompt = null;

document.addEventListener('DOMContentLoaded', () => {
  const filterInput = document.getElementById('filterDate');
  if (filterInput) filterInput.valueAsDate = new Date();
  
  bindEvents();
  updateUI();
});

function saveData() {
  localStorage.setItem('myStore_customers', JSON.stringify(customers));
  localStorage.setItem('myStore_stock', JSON.stringify(stock));
  localStorage.setItem('myStore_sales', JSON.stringify(sales));
}

// ==========================================
// 3. التنقل الفعال بين الشاشات
// ==========================================
function switchTab(tabId, btnElement) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
  document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(btn => btn.classList.remove('active'));

  const targetTab = document.getElementById(tabId);
  if (targetTab) targetTab.classList.add('active');

  const currentTabName = tabId.replace('Tab', '');
  document.querySelectorAll('.tab-btn, .mobile-nav-btn').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(tabId)) {
      btn.classList.add('active');
    }
  });

  if (window.lucide) lucide.createIcons();
}

// ==========================================
// 4. البيع والعمليات الحسابية
// ==========================================
function findProductByBarcode(barcodeVal) {
  if (!barcodeVal) return;
  const item = stock.find(s => s.barcode && s.barcode.trim() === barcodeVal.trim());
  if (item) {
    document.getElementById('saleItemName').value = item.name;
    autoFillPrice();
  }
}

function autoFillPrice() {
  const name = document.getElementById('saleItemName').value.trim();
  const qty = parseInt(document.getElementById('saleQty').value) || 1;
  const stockItem = stock.find(s => s.name.toLowerCase() === name.toLowerCase());

  if (stockItem) {
    document.getElementById('salePrice').value = stockItem.sellPrice * qty;
    document.getElementById('costPrice').value = stockItem.buyPrice * qty;
    if (stockItem.barcode) {
      document.getElementById('saleBarcode').value = stockItem.barcode;
    }
  }
}

function toggleCustomerInput() {
  const type = document.getElementById('saleType').value;
  const group = document.getElementById('customerSelectGroup');
  if (group) group.style.display = type === 'debt' ? 'flex' : 'none';
}

// ==========================================
// ربط أحداث النماذج (Form Submissions)
// ==========================================
function bindEvents() {
  // 1. نموذج المبيعات
  const saleForm = document.getElementById('saleForm');
  if (saleForm) {
    saleForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const itemName = document.getElementById('saleItemName').value.trim();
      const qty = parseInt(document.getElementById('saleQty').value) || 0;
      const price = parseFloat(document.getElementById('salePrice').value) || 0;
      const cost = parseFloat(document.getElementById('costPrice').value) || 0;
      const type = document.getElementById('saleType').value;
      const customerName = document.getElementById('saleCustomerName').value.trim();

      if (!itemName || qty <= 0) {
        alert("يرجى إدخال اسم المادة والكمية بشكل صحيح.");
        return;
      }

      const now = new Date();
      const todayIso = now.toISOString().slice(0, 10);
      const newSale = {
        id: Date.now(),
        item: itemName,
        qty, price, cost,
        profit: price - cost,
        type,
        customerName: type === 'debt' ? customerName : '',
        date: now.toLocaleDateString('ar-IQ'),
        time: now.toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' }),
        isoDate: todayIso
      };

      sales.push(newSale);

      const stockItem = stock.find(s => s.name.toLowerCase() === itemName.toLowerCase());
      if (stockItem) {
        stockItem.qty = Math.max(0, stockItem.qty - qty);
      }

      if (type === 'debt' && customerName) {
        const customer = getOrCreateCustomer(customerName);
        customer.history.push({
          id: Date.now() + 1,
          date: now.toLocaleDateString('ar-IQ'),
          amount: price,
          details: `شراء ${qty}x ${itemName}`,
          type: 'debt'
        });
      }

      saveData();
      updateUI();

      // خيار طباعة وصل البيع فور الاتمام
      if (confirm("تم تسجيل البيع بنجاح! هل تريد طباعة وصل البيع الآن؟")) {
        printReceipt(newSale.id);
      }

      e.target.reset();
      document.getElementById('typeCash').checked = true;
      document.getElementById('saleType').value = 'cash';
      toggleCustomerInput();
      document.getElementById('saleBarcode').focus();
    });
  }

  // 2. نموذج إضافة وتعديل المواد في المخزن
  const stockForm = document.getElementById('stockForm');
  if (stockForm) {
    stockForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const editId = document.getElementById('stockEditId').value;
      const barcode = document.getElementById('itemBarcode').value.trim();
      const name = document.getElementById('itemName').value.trim();
      const qty = parseInt(document.getElementById('itemQty').value) || 0;
      const buyPrice = parseFloat(document.getElementById('buyPrice').value) || 0;
      const sellPrice = parseFloat(document.getElementById('sellPrice').value) || 0;

      if (!name) {
        alert("يرجى إدخال اسم المادة.");
        return;
      }

      if (editId) {
        // تحديث مادة موجودة مسبقاً
        const item = stock.find(s => s.id === parseInt(editId));
        if (item) {
          item.barcode = barcode;
          item.name = name;
          item.qty = qty;
          item.buyPrice = buyPrice;
          item.sellPrice = sellPrice;
        }
      } else {
        // إضافة مادة جديدة
        const newItem = {
          id: Date.now(),
          barcode,
          name,
          qty,
          buyPrice,
          sellPrice
        };
        stock.push(newItem);
      }

      saveData();
      updateUI();
      resetStockForm();
      alert("تم حفظ بيانات المادة بنجاح!");
    });
  }

  // 3. نموذج إضافة الدين المباشر
  const debtForm = document.getElementById('debtForm');
  if (debtForm) {
    debtForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const customerName = document.getElementById('customerName').value.trim();
      const amount = parseFloat(document.getElementById('debtAmount').value) || 0;
      const details = document.getElementById('debtDetails').value.trim();

      if (!customerName || amount <= 0) {
        alert("يرجى إدخال اسم الزبون والمبلغ بشكل صحيح.");
        return;
      }

      const customer = getOrCreateCustomer(customerName);
      customer.history.push({
        id: Date.now(),
        date: new Date().toLocaleDateString('ar-IQ'),
        amount: amount,
        details: details || 'دين مباشر',
        type: 'debt'
      });

      saveData();
      updateUI();
      e.target.reset();
      alert("تم تسجيل الدين بنجاح!");
    });
  }
}

// دالة تفريغ وإعادة إعداد نموذج المخزن
function resetStockForm() {
  const stockForm = document.getElementById('stockForm');
  if (stockForm) stockForm.reset();
  
  const editIdEl = document.getElementById('stockEditId');
  if (editIdEl) editIdEl.value = '';

  const titleEl = document.getElementById('stockFormTitle');
  if (titleEl) titleEl.textContent = 'إضافة / تعديل مادة في المخزن';

  const submitBtn = document.getElementById('stockSubmitBtn');
  if (submitBtn && submitBtn.querySelector('span')) {
    submitBtn.querySelector('span').textContent = 'حفظ المادة';
  }
  
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'none';
}

// ==========================================
// 5. تحديث وتجميل الواجهات (UI)
// ==========================================
function updateUI() {
  renderSummary();
  renderSales();
  renderDebts();
  renderStock();
  updateDatalists();
  renderTopSelling();
  checkLowStock();
  if (window.lucide) lucide.createIcons();
}

function renderSummary() {
  const totalDebtsVal = customers.reduce((sum, c) => sum + Math.max(0, getCustomerBalance(c)), 0);
  const totalSalesVal = sales.reduce((sum, s) => sum + s.price, 0);
  const totalProfitVal = sales.reduce((sum, s) => sum + s.profit, 0);
  const inventoryValueVal = stock.reduce((sum, i) => sum + (i.qty * i.buyPrice), 0);

  document.getElementById('totalDebts').textContent = `${totalDebtsVal.toLocaleString('ar-IQ')} د.ع`;
  document.getElementById('totalSales').textContent = `${totalSalesVal.toLocaleString('ar-IQ')} د.ع`;
  document.getElementById('totalProfit').textContent = `${totalProfitVal.toLocaleString('ar-IQ')} د.ع`;
  document.getElementById('inventoryValue').textContent = `${inventoryValueVal.toLocaleString('ar-IQ')} د.ع`;
}

function renderSales() {
  const filterInput = document.getElementById('filterDate');
  const filterDateVal = filterInput ? filterInput.value : '';
  const filteredSales = filterDateVal ? sales.filter(s => s.isoDate === filterDateVal) : sales;
  const salesList = document.getElementById('salesList');

  if (!salesList) return;

  if (filteredSales.length === 0) {
    salesList.innerHTML = '<li style="justify-content: center; color: var(--text-muted);">لا توجد مبيعات مسجلة لهذا اليوم</li>';
    return;
  }

  salesList.innerHTML = filteredSales.slice(-10).reverse().map(s => `
    <li>
      <div>
        <strong>${s.item}</strong> <span style="color: var(--primary);">(${s.qty}x)</span>
        <br><small style="color: var(--text-muted);">${s.price.toLocaleString('ar-IQ')} د.ع | ${s.type === 'debt' ? `دين: ${s.customerName}` : 'كاش'}</small>
      </div>
      <div style="display: flex; gap: 6px;">
        <button onclick="printReceipt(${s.id})" class="btn btn-icon-only" style="color: var(--primary);" title="طباعة وصل البيع"><i data-lucide="printer"></i></button>
        <button onclick="deleteSale(${s.id})" class="btn btn-icon-only" style="color: var(--danger);" title="حذف البيع"><i data-lucide="trash-2"></i></button>
      </div>
    </li>
  `).join('');
}

// ==========================================
// 6. دالة طباعة وصل البيع (Receipt Print)
// ==========================================
function printReceipt(saleId) {
  const sale = sales.find(s => s.id === saleId);
  if (!sale) {
    alert("لم يتم العثور على عملية البيع!");
    return;
  }

  const printWindow = window.open('', '_blank', 'width=400,height=600');
  const receiptHTML = `
    <!DOCTYPE html>
    <html dir="rtl" lang="ar">
    <head>
      <meta charset="UTF-8">
      <title>وصل بيع - تراكم</title>
      <style>
        body {
          font-family: system-ui, -apple-system, sans-serif;
          width: 280px;
          margin: 0 auto;
          padding: 10px;
          color: #000;
          direction: rtl;
          text-align: right;
        }
        .header {
          text-align: center;
          border-bottom: 2px dashed #000;
          padding-bottom: 8px;
          margin-bottom: 10px;
        }
        .header h2 { margin: 0; font-size: 20px; }
        .header p { margin: 3px 0 0; font-size: 12px; }
        .info { font-size: 12px; margin-bottom: 10px; line-height: 1.5; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 13px; }
        th, td { padding: 6px 0; border-bottom: 1px solid #ccc; }
        th { text-align: right; }
        .total {
          border-top: 2px dashed #000;
          padding-top: 8px;
          font-weight: bold;
          font-size: 15px;
          display: flex;
          justify-content: space-between;
        }
        .footer { text-align: center; margin-top: 15px; font-size: 11px; color: #555; }
        @media print {
          @page { margin: 0; }
          body { padding: 5px; }
        }
      </style>
    </head>
    <body>
      <div class="header">
        <h2>اسواق البركة</h2>
        <p>وصل بيع تسوق</p>
      </div>

      <div class="info">
        <div><strong>التاريخ:</strong> ${sale.date} ${sale.time || ''}</div>
        <div><strong>رقم الوصل:</strong> #${sale.id.toString().slice(-6)}</div>
        <div><strong>نوع الدفع:</strong> ${sale.type === 'debt' ? `آجل (دين: ${sale.customerName})` : 'نقدي (كاش)'}</div>
      </div>

      <table>
        <thead>
          <tr>
            <th>المادة</th>
            <th style="text-align: center;">العدد</th>
            <th style="text-align: left;">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>${sale.item}</td>
            <td style="text-align: center;">${sale.qty}</td>
            <td style="text-align: left;">${sale.price.toLocaleString('ar-IQ')} د.ع</td>
          </tr>
        </tbody>
      </table>

      <div class="total">
        <span>المجموع الكلي:</span>
        <span>${sale.price.toLocaleString('ar-IQ')} د.ع</span>
      </div>

      <div class="footer">
        <p>شكراً لزيارتكم! نتمنى لكم يوماً سعيداً</p>
      </div>

      <script>
        window.onload = function() {
          window.print();
          setTimeout(() => window.close(), 500);
        };
      </script>
    </body>
    </html>
  `;

  printWindow.document.write(receiptHTML);
  printWindow.document.close();
}

function deleteSale(saleId) {
  if (confirm("حذف عملية البيع هذه؟")) {
    sales = sales.filter(s => s.id !== saleId);
    saveData(); updateUI();
  }
}

function getOrCreateCustomer(name) {
  let customer = customers.find(c => c.name.trim().toLowerCase() === name.trim().toLowerCase());
  if (!customer) {
    customer = { id: Date.now(), name: name.trim(), history: [] };
    customers.push(customer);
  }
  return customer;
}

function getCustomerBalance(customer) {
  return customer.history.reduce((sum, item) => item.type === 'debt' ? sum + item.amount : sum - item.amount, 0);
}

function renderDebts() {
  const searchEl = document.getElementById('searchDebtInput');
  const searchQuery = (searchEl ? searchEl.value : '').toLowerCase();
  const debtList = document.getElementById('debtList');
  if (!debtList) return;

  const filtered = customers.filter(c => c.name.toLowerCase().includes(searchQuery));

  if (filtered.length === 0) {
    debtList.innerHTML = '<li style="justify-content: center; color: var(--text-muted);">لا يوجد زبائن مطبقين للبحث</li>';
    return;
  }

  debtList.innerHTML = filtered.map(c => {
    const balance = getCustomerBalance(c);
    return `
      <li>
        <div>
          <strong>👤 ${c.name}</strong>
          <br><small style="color: var(--text-muted);">حساب متبقي</small>
        </div>
        <div style="text-align: left;">
          <strong style="color: ${balance > 0 ? 'var(--danger)' : 'var(--success)'}; font-size: 1.1rem;">
            ${balance.toLocaleString('ar-IQ')} د.ع
          </strong>
          <div style="margin-top: 6px; display: flex; gap: 4px;">
            <button onclick="payCustomerDebt(${c.id})" class="btn btn-subtle" style="padding: 4px 10px; font-size: 0.8rem;">تسديد</button>
            <button onclick="deleteCustomer(${c.id})" class="btn btn-icon-only" style="color: var(--danger);"><i data-lucide="trash"></i></button>
          </div>
        </div>
      </li>
    `;
  }).join('');
}

function payCustomerDebt(customerId) {
  const customer = customers.find(c => c.id === customerId);
  if (!customer) return;
  const payInput = prompt(`المبلغ المدفوع تسديداً لـ (${customer.name}):`);
  if (payInput && !isNaN(payInput) && parseFloat(payInput) > 0) {
    customer.history.push({
      id: Date.now(),
      date: new Date().toLocaleDateString('ar-IQ'),
      amount: parseFloat(payInput),
      details: 'تسديد نقدي',
      type: 'payment'
    });
    saveData(); updateUI();
  }
}

function deleteCustomer(customerId) {
  if (confirm("حذف حساب الزبون نهائياً؟")) {
    customers = customers.filter(c => c.id !== customerId);
    saveData(); updateUI();
  }
}

// ==========================================
// عرض وتعديل وحذف مواد المخزن
// ==========================================
function renderStock() {
  const searchEl = document.getElementById('searchStockInput');
  const searchQuery = (searchEl ? searchEl.value : '').toLowerCase();
  const stockList = document.getElementById('stockList');
  if (!stockList) return;

  const filtered = stock.filter(s => s.name.toLowerCase().includes(searchQuery) || (s.barcode && s.barcode.includes(searchQuery)));

  if (filtered.length === 0) {
    stockList.innerHTML = '<li style="justify-content: center; color: var(--text-muted);">لا توجد مواد مطابقة في المخزن</li>';
    return;
  }

  stockList.innerHTML = filtered.map(s => `
    <li>
      <div>
        <strong>${s.name}</strong> ${s.barcode ? `<small style="color: var(--primary);">(${s.barcode})</small>` : ''}
        <br><small style="color: var(--text-muted);">الكمية: ${s.qty} | شراء: ${(s.buyPrice || 0).toLocaleString('ar-IQ')} | بيع: ${s.sellPrice.toLocaleString('ar-IQ')} د.ع</small>
      </div>
      <div style="display: flex; gap: 6px;">
        <button onclick="editStock(${s.id})" class="btn btn-icon-only" style="color: var(--primary);" title="تعديل المادة"><i data-lucide="edit-3"></i></button>
        <button onclick="deleteStock(${s.id})" class="btn btn-icon-only" style="color: var(--danger);" title="حذف المادة"><i data-lucide="trash-2"></i></button>
      </div>
    </li>
  `).join('');
}

// دالة جلب بيانات المادة ووضعها في الحقول للتعديل
function editStock(id) {
  const item = stock.find(s => s.id === id);
  if (!item) return;

  document.getElementById('stockEditId').value = item.id;
  document.getElementById('itemBarcode').value = item.barcode || '';
  document.getElementById('itemName').value = item.name || '';
  document.getElementById('itemQty').value = item.qty || 0;
  document.getElementById('buyPrice').value = item.buyPrice || 0;
  document.getElementById('sellPrice').value = item.sellPrice || 0;

  const titleEl = document.getElementById('stockFormTitle');
  if (titleEl) titleEl.textContent = 'تعديل مادة: ' + item.name;

  const submitBtn = document.getElementById('stockSubmitBtn');
  if (submitBtn && submitBtn.querySelector('span')) {
    submitBtn.querySelector('span').textContent = 'تحديث المادة';
  }

  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.style.display = 'inline-flex';

  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function deleteStock(id) {
  if (confirm("هل أنت تأكد من حذف هذه المادة من المخزن؟")) {
    stock = stock.filter(s => s.id !== id);
    saveData(); updateUI();
  }
}

function updateDatalists() {
  const customerDl = document.getElementById('customersDatalist');
  if (customerDl) customerDl.innerHTML = customers.map(c => `<option value="${c.name}">`).join('');

  const stockDl = document.getElementById('stockDatalist');
  if (stockDl) stockDl.innerHTML = stock.map(s => `<option value="${s.name}">`).join('');
}

function checkLowStock() {
  const lowStockAlert = document.getElementById('lowStockAlert');
  const lowStockList = document.getElementById('lowStockList');
  if (!lowStockAlert || !lowStockList) return;

  const lowItems = stock.filter(s => s.qty <= 3);
  if (lowItems.length > 0) {
    lowStockAlert.style.display = 'flex';
    lowStockList.innerHTML = lowItems.map(i => `<li>${i.name} - المتبقي: <strong>${i.qty}</strong> قطع فقط</li>`).join('');
  } else {
    lowStockAlert.style.display = 'none';
  }
}

function renderTopSelling() {
  const topSellingList = document.getElementById('topSellingList');
  if (!topSellingList) return;

  const totals = {};
  sales.forEach(s => totals[s.item] = (totals[s.item] || 0) + s.qty);

  const sorted = Object.keys(totals).sort((a,b) => totals[b] - totals[a]);

  if (sorted.length === 0) {
    topSellingList.innerHTML = '<li style="justify-content: center; color: var(--text-muted);">لا توجد مبيعات بعد</li>';
    return;
  }

  topSellingList.innerHTML = sorted.map((name, i) => `
    <li>
      <strong>#${i+1} ${name}</strong>
      <span style="background: var(--primary-glow); color: var(--primary); padding: 4px 10px; border-radius: var(--radius-sm); font-weight: bold; font-size: 0.85rem;">
        المباع: ${totals[name]} قطعة
      </span>
    </li>
  `).join('');
}

// النسخ الاحتياطي وإعادة الضبط
function resetSystemData() {
  if (confirm("🚨 هل أنت تأكد من رغبتك في تصفير كل البيانات؟")) {
    localStorage.clear();
    customers = []; stock = []; sales = [];
    saveData(); updateUI();
    alert("تم تصفير النظام بالكامل بنجاح!");
  }
}

function resetStatsData() {
  if (confirm("🚨 تصفير المبيعات والإحصائيات فقط؟")) {
    sales = [];
    saveData(); updateUI();
    alert("تم تصفير المبيعات!");
  }
}

function exportBackup() {
  const backup = { customers, stock, sales };
  const a = document.createElement('a');
  a.href = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup));
  a.download = `TARAKUM_BACKUP_${new Date().toISOString().slice(0,10)}.json`;
  a.click();
}

function importBackup(e) {
  const reader = new FileReader();
  reader.onload = (event) => {
    try {
      const data = JSON.parse(event.target.result);
      if (data.customers && data.stock && data.sales) {
        customers = data.customers; stock = data.stock; sales = data.sales;
        saveData(); updateUI();
        alert("تمت استعادة النسخة الاحتياطية بنجاح!");
      }
    } catch(err) {
      alert("حدث خطأ أثناء قراءة الملف.");
    }
  };
  if (e.target.files[0]) reader.readAsText(e.target.files[0]);
}

function printDailyReport() {
  window.print();
}
// ==========================================
// إدارة إشعار التثبيت المخصص (PWA Install Prompt)
// ==========================================
let pwaPromptEvent;

window.addEventListener('beforeinstallprompt', (e) => {
  // منع كروم من الانتظار أو التصرف التلقائي
  e.preventDefault();
  pwaPromptEvent = e;

  // إظهار الشريط المنسدل الخاص بنا في أعلى الشاشة
  const banner = document.getElementById('pwaInstallBanner');
  if (banner) {
    banner.style.display = 'flex';
  }
});

// عند الضغط على زر التثبيت داخل الشريط
document.getElementById('btnPwaInstall')?.addEventListener('click', async () => {
  if (!pwaPromptEvent) return;

  // إظهار نافذة التثبيت الرسمية الخاصة بـ كروم
  pwaPromptEvent.prompt();

  const { outcome } = await pwaPromptEvent.userChoice;
  console.log(`نتيجة التثبيت: ${outcome}`);

  // إخفاء الشريط بعد اتخاذ القرار
  pwaPromptEvent = null;
  document.getElementById('pwaInstallBanner').style.display = 'none';
});

// إخفاء الشريط تلقائياً إذا كان التطبيق مثبتاً بالفعل
window.addEventListener('appinstalled', () => {
  document.getElementById('pwaInstallBanner').style.display = 'none';
  console.log('تم تثبيت التطبيق بنجاح!');
});
// ==========================================
// إدارة زر التثبيت المباشر داخل واجهة الموقع
// ==========================================
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  // منع العرض التلقائي العشوائي من المتصفح
  e.preventDefault();
  deferredInstallPrompt = e;

  // إظهار زر التثبيت المباشر في الواجهة
  const installBtn = document.getElementById('mainInstallBtn');
  if (installBtn) {
    installBtn.style.display = 'inline-flex';
  }
});

// عند ضغط المستخدم على زر التثبيت في الواجهة
document.getElementById('mainInstallBtn')?.addEventListener('click', async () => {
  const installBtn = document.getElementById('mainInstallBtn');

  if (deferredInstallPrompt) {
    // إظهار النافذة المنبثقة الرسمية للتثبيت
    deferredInstallPrompt.prompt();

    // انتظار اختيار المستخدم (موافقة / إلغاء)
    const { outcome } = await deferredInstallPrompt.userChoice;
    console.log(`قرار المستخدم: ${outcome}`);

    // إعادة ضبط المتغير وإخفاء الزر إذا تمت الموافقة
    deferredInstallPrompt = null;
    if (installBtn) installBtn.style.display = 'none';
  } else {
    // في حال عدم دعم المتصفح للحدث أو فتح الموقع عبر الرابط مباشرة
    alert("لتثبيت التطبيق:\n1. اضغط على قائمة المتصفح (⋮) في الأعلى.\n2. اختر 'التثبيت' أو 'الإضافة إلى الشاشة الرئيسية'.");
  }
});

// إخفاء الزر تلقائياً إذا كان التطبيق مثبتاً بالفعل
window.addEventListener('appinstalled', () => {
  const installBtn = document.getElementById('mainInstallBtn');
  if (installBtn) installBtn.style.display = 'none';
  console.log('تم تثبيت التطبيق بنجاح!');
});