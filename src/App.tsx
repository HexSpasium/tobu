import { useEffect, useMemo, useState } from 'react';
import {
  Activity, CalendarDays, Check, ChevronDown, Clock3, Coffee, CreditCard,
  LayoutDashboard, LogOut, Minus, Plus, Search, Settings2, ShoppingBag,
  Store, Trash2, Utensils, Wallet, X
} from 'lucide-react';

type Category = { id: string; name: string };
type Product = { id: string; categoryId: string; name: string; description: string; price: number; active: boolean };
type Line = { productId: string; name: string; price: number; qty: number };
type Order = {
  id: string; kind: 'table' | 'walkin'; tableId?: string; tableName?: string;
  items: Line[]; total: number; status: 'open' | 'paid' | 'cancelled';
  createdAt: string; closedAt?: string;
};
type Table = { id: string; name: string; active: boolean };

const initialCategories: Category[] = [
  { id: 'wraps', name: 'Dürümler' }, { id: 'portion', name: 'Porsiyon' },
  { id: 'slice', name: 'Dilim' }, { id: 'drinks', name: 'İçecekler' }
];
const initialProducts: Product[] = [
  { id: 'p1', categoryId: 'wraps', name: 'Çiğköfte Dürüm', description: 'Dolu Dolu Lezzet', price: 120, active: true },
  { id: 'p2', categoryId: 'wraps', name: 'Mega Dürüm', description: 'Extra Dolu Lezzet', price: 170, active: true },
  { id: 'p3', categoryId: 'wraps', name: 'Doritoslu Dürüm', description: 'Çıtır Lezzet', price: 140, active: true },
  { id: 'p4', categoryId: 'wraps', name: 'Doritoslu Mega Dürüm', description: 'Extra Çıtır', price: 190, active: true },
  { id: 'p5', categoryId: 'portion', name: 'Küçük Porsiyon', description: '300 GR', price: 250, active: true },
  { id: 'p6', categoryId: 'portion', name: 'Büyük Porsiyon', description: '500 GR', price: 350, active: true },
  { id: 'p7', categoryId: 'portion', name: 'Aile Boyu Porsiyon', description: '750 GR', price: 530, active: true },
  { id: 'p8', categoryId: 'portion', name: 'Mega Porsiyon', description: '1000 GR', price: 700, active: true },
  { id: 'p9', categoryId: 'slice', name: 'Çıtır Dilim', description: 'Dolu Dolu Çıtır Lezzet', price: 190, active: true },
  { id: 'p10', categoryId: 'slice', name: 'Lokum Dilim', description: 'Dolu Dolu Enfes Lezzet', price: 190, active: true },
  { id: 'p11', categoryId: 'drinks', name: 'Ayran', description: '', price: 30, active: true },
  { id: 'p12', categoryId: 'drinks', name: 'Şalgam', description: '', price: 35, active: true },
  { id: 'p13', categoryId: 'drinks', name: 'Kola', description: '', price: 50, active: true },
  { id: 'p14', categoryId: 'drinks', name: 'Soda', description: '', price: 25, active: true },
  { id: 'p15', categoryId: 'drinks', name: 'Meyveli Soda', description: '', price: 30, active: true }
];
const initialTables: Table[] = Array.from({ length: 10 }, (_, i) => ({ id: 't' + (i + 1), name: 'Masa ' + (i + 1), active: true }));
const money = (n: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(n);
const todayKey = () => new Date().toLocaleDateString('en-CA');

function read<T>(key: string, fallback: T): T {
  try { const value = localStorage.getItem('tobu:' + key); return value ? JSON.parse(value) as T : fallback; }
  catch { return fallback; }
}
function uid() { return crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random(); }
function dateText(value: string) {
  return new Date(value).toLocaleString('tr-TR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export default function App() {
  const [categories, setCategories] = useState(() => read('categories', initialCategories));
  const [products, setProducts] = useState(() => read('products', initialProducts));
  const [tables, setTables] = useState(() => read('tables', initialTables));
  const [orders, setOrders] = useState(() => read<Order[]>('orders', []));
  const [authed, setAuthed] = useState(() => sessionStorage.getItem('tobu:session') === 'ok');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [screen, setScreen] = useState('dashboard');
  const [selectedTable, setSelectedTable] = useState<string | null>(null);
  const [walkin, setWalkin] = useState(false);
  const [cart, setCart] = useState<Line[]>([]);
  const [category, setCategory] = useState('all');
  const [search, setSearch] = useState('');
  const [notice, setNotice] = useState('');
  const [historyDate, setHistoryDate] = useState(todayKey());
  const [editor, setEditor] = useState<Product | null>(null);
  const [newCategory, setNewCategory] = useState('');
  const [tableName, setTableName] = useState('');

  useEffect(() => { localStorage.setItem('tobu:categories', JSON.stringify(categories)); }, [categories]);
  useEffect(() => { localStorage.setItem('tobu:products', JSON.stringify(products)); }, [products]);
  useEffect(() => { localStorage.setItem('tobu:tables', JSON.stringify(tables)); }, [tables]);
  useEffect(() => { localStorage.setItem('tobu:orders', JSON.stringify(orders)); }, [orders]);

  const openOrders = orders.filter(o => o.status === 'open');
  const todayOrders = orders.filter(o => o.status === 'paid' && o.closedAt?.slice(0, 10) === todayKey());
  const todaySales = todayOrders.reduce((s, o) => s + o.total, 0);
  const productMap = useMemo(() => new Map(products.map(p => [p.id, p])), [products]);
  const activeProducts = products.filter(p => p.active && (category === 'all' || p.categoryId === category) && (p.name + ' ' + p.description).toLocaleLowerCase('tr').includes(search.toLocaleLowerCase('tr')));

  function login(e: React.FormEvent) {
    e.preventDefault();
    // Temporary local demo credentials; replace with server-side authentication before production.
    if (username === 'admin' && password === 'tobu1234') {
      sessionStorage.setItem('tobu:session', 'ok'); setAuthed(true); setNotice('');
    } else setNotice('Kullanıcı adı veya şifre hatalı.');
  }
  function logout() { sessionStorage.removeItem('tobu:session'); setAuthed(false); setUsername(''); setPassword(''); }
  function addToCart(p: Product) {
    setCart(old => {
      const found = old.find(x => x.productId === p.id);
      return found ? old.map(x => x.productId === p.id ? { ...x, qty: x.qty + 1 } : x)
        : [...old, { productId: p.id, name: p.name, price: p.price, qty: 1 }];
    });
  }
  function updateQty(id: string, delta: number) {
    setCart(old => old.map(x => x.productId === id ? { ...x, qty: x.qty + delta } : x).filter(x => x.qty > 0));
  }
  function beginTable(table: Table) {
    setWalkin(false); setSelectedTable(table.id);
    const current = openOrders.find(o => o.tableId === table.id);
    setCart(current ? current.items : []);
    setScreen('pos');
  }
  function beginWalkin() { setWalkin(true); setSelectedTable(null); setCart([]); setScreen('pos'); }
  function saveOrder() {
    if (!cart.length) return;
    const total = cart.reduce((s, x) => s + x.price * x.qty, 0);
    if (walkin) {
      const order: Order = { id: uid(), kind: 'walkin', tableName: 'Ayaküstü', items: cart, total, status: 'paid', createdAt: new Date().toISOString(), closedAt: new Date().toISOString() };
      setOrders(old => [order, ...old]); setNotice('Ayaküstü satış kaydedildi.'); setCart([]); setScreen('walkin');
    } else if (selectedTable) {
      const existing = openOrders.find(o => o.tableId === selectedTable);
      const merged = existing ? [...existing.items, ...cart].reduce<Line[]>((acc, line) => {
        const f = acc.find(x => x.productId === line.productId);
        if (f) f.qty += line.qty; else acc.push({ ...line });
        return acc;
      }, []) : cart;
      const order: Order = {
        id: existing?.id || uid(), kind: 'table', tableId: selectedTable,
        tableName: tables.find(t => t.id === selectedTable)?.name || 'Masa',
        items: merged, total: merged.reduce((s, x) => s + x.price * x.qty, 0),
        status: 'open', createdAt: existing?.createdAt || new Date().toISOString()
      };
      setOrders(old => existing ? old.map(o => o.id === existing.id ? order : o) : [order, ...old]);
      setCart([]); setNotice('Sipariş masaya kaydedildi.'); setScreen('tables');
    }
  }
  function closeOrder(order: Order, status: 'paid' | 'cancelled') {
    setOrders(old => old.map(o => o.id === order.id ? { ...o, status, closedAt: new Date().toISOString() } : o));
    setNotice(status === 'paid' ? 'Ödeme alındı, satış geçmişine kaydedildi.' : 'Sipariş iptal edildi.');
  }
  function addTable() {
    const name = tableName.trim() || 'Masa ' + (tables.length + 1);
    setTables(old => [...old, { id: uid(), name, active: true }]); setTableName('');
  }
  function removeTable(id: string) {
    if (openOrders.some(o => o.tableId === id)) { setNotice('Siparişi açık olan masa silinemez. Önce hesabı kapatın.'); return; }
    setTables(old => old.filter(t => t.id !== id));
  }
  function saveProduct() {
    if (!editor || !editor.name.trim() || !categories.some(c => c.id === editor.categoryId)) return;
    setProducts(old => old.some(p => p.id === editor.id) ? old.map(p => p.id === editor.id ? editor : p) : [...old, editor]);
    setEditor(null);
  }
  function deleteProduct(id: string) { setProducts(old => old.map(p => p.id === id ? { ...p, active: false } : p)); }
  function addCategory() {
    if (!newCategory.trim()) return;
    setCategories(old => [...old, { id: uid(), name: newCategory.trim() }]); setNewCategory('');
  }

  if (!authed) return <div className="login-page">
    <div className="login-brand"><div className="brand-mark">T</div><span>TOBU</span><small>ÇİĞ KÖFTE • İŞLETME YÖNETİMİ</small></div>
    <form className="login-card" onSubmit={login}>
      <div className="eyebrow">YÖNETİCİ PANELİ</div><h1>Hoş geldiniz</h1><p>Devam etmek için hesabınıza giriş yapın.</p>
      <label>Kullanıcı adı<input value={username} onChange={e => setUsername(e.target.value)} placeholder="Kullanıcı adınız" autoComplete="username" /></label>
      <label>Şifre<input value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" type="password" autoComplete="current-password" /></label>
      {notice && <div className="error">{notice}</div>}
      <button className="primary full" type="submit">Giriş Yap <span>→</span></button>
      <div className="login-hint">İlk kurulum demo girişi: <b>admin</b> / <b>tobu1234</b></div>
    </form>
    <div className="login-foot">TOBU POS <span>•</span> Sipariş ve satış yönetimi</div>
  </div>;

  const nav = [
    { id: 'dashboard', label: 'Genel Bakış', icon: LayoutDashboard },
    { id: 'tables', label: 'Masalarım', icon: Utensils },
    { id: 'walkin', label: 'Ayaküstü Satış', icon: ShoppingBag },
    { id: 'products', label: 'Ürünlerim', icon: Store },
    { id: 'history', label: 'Satış Geçmişi', icon: CalendarDays }
  ];
  const displayedHistory = orders.filter(o => o.status !== 'open' && (o.closedAt || o.createdAt).slice(0, 10) === historyDate);
  const historyTotal = displayedHistory.filter(o => o.status === 'paid').reduce((s, o) => s + o.total, 0);

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="side-brand"><div className="brand-mark small">T</div><div><b>TOBU</b><small>ÇİĞ KÖFTE</small></div></div>
      <div className="side-label">MENÜ</div>
      <nav>{nav.map(item => <button key={item.id} className={'nav-item ' + (screen === item.id || (screen === 'pos' && item.id === (walkin ? 'walkin' : 'tables')) ? 'active' : '')} onClick={() => { setScreen(item.id); setNotice(''); }}>
        <item.icon size={18} strokeWidth={1.8}/><span>{item.label}</span>{item.id === 'tables' && openOrders.length > 0 && <i>{openOrders.length}</i>}
      </button>)}</nav>
      <div className="side-bottom"><div className="store-status"><span className="pulse"></span><div><b>İşletme açık</b><small>Yerel çalışma modu</small></div></div>
        <button className="nav-item" onClick={logout}><LogOut size={18}/><span>Oturumu Kapat</span></button>
        <div className="version">TOBU POS <span>v1.0.0</span></div>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><div className="crumb">TOBU / <b>{nav.find(n => n.id === screen)?.label || (walkin ? 'Ayaküstü Satış' : 'Sipariş Oluştur')}</b></div><div className="top-date"><Clock3 size={14}/> {new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</div></div>
        <div className="top-user"><div className="avatar">A</div><div><b>Yönetici</b><small>Admin hesabı</small></div><ChevronDown size={15}/></div>
      </header>
      <div className="content">
        {notice && <div className="notice"><Check size={16}/>{notice}<button onClick={() => setNotice('')}><X size={15}/></button></div>}
        {screen === 'dashboard' && <section>
          <div className="page-heading"><div><div className="eyebrow">İŞLETME ÖZETİ</div><h1>Genel Bakış</h1><p>TOBU işletmenizin bugünkü durumuna göz atın.</p></div><button className="primary" onClick={beginWalkin}><Plus size={17}/> Yeni Satış</button></div>
          <div className="stat-grid">
            <div className="stat-card"><div className="stat-icon gold"><Wallet/></div><span>Bugünkü Ciro</span><strong>{money(todaySales)}</strong><small>Ödemesi alınan satışlar</small></div>
            <div className="stat-card"><div className="stat-icon green"><Utensils/></div><span>Dolu Masalar</span><strong>{new Set(openOrders.map(o => o.tableId)).size}</strong><small>{tables.length} masa içinden</small></div>
            <div className="stat-card"><div className="stat-icon blue"><CreditCard/></div><span>Bugünkü İşlem</span><strong>{todayOrders.length}</strong><small>Tamamlanan satış</small></div>
            <div className="stat-card"><div className="stat-icon orange"><Activity/></div><span>Açık Hesap</span><strong>{openOrders.length}</strong><small>Ödeme bekleyen masa</small></div>
          </div>
          <div className="dashboard-grid">
            <div className="panel"><div className="panel-head"><div><h2>Masaların Durumu</h2><p>Aktif siparişlerinize hızlı erişin.</p></div><button className="text-btn" onClick={() => setScreen('tables')}>Tüm masalar →</button></div>
              <div className="mini-tables">{tables.slice(0, 8).map(t => { const o = openOrders.find(x => x.tableId === t.id); return <button className={'mini-table ' + (o ? 'occupied' : '')} key={t.id} onClick={() => beginTable(t)}><Utensils size={18}/><b>{t.name}</b><small>{o ? money(o.total) : 'Boş masa'}</small></button>; })}</div>
            </div>
            <div className="panel"><div className="panel-head"><div><h2>Son İşlemler</h2><p>Son kaydedilen satışlar.</p></div></div>
              <div className="activity-list">{orders.filter(o => o.status !== 'open').slice(0, 5).map(o => <div className="activity-row" key={o.id}><div className="activity-dot"><ShoppingBag size={15}/></div><div className="activity-info"><b>{o.tableName || 'Satış'}</b><small>{dateText(o.closedAt || o.createdAt)}</small></div><strong>{money(o.total)}</strong></div>)}
                {!orders.some(o => o.status !== 'open') && <div className="empty-state compact">Henüz tamamlanmış işlem yok.</div>}</div>
            </div>
          </div>
          <div className="panel quick-panel"><div><h2>Hızlı İşlemler</h2><p>Günlük operasyonlarınıza buradan başlayın.</p></div><div className="quick-actions"><button onClick={() => setScreen('tables')}><Utensils/> Masa siparişi</button><button onClick={beginWalkin}><ShoppingBag/> Ayaküstü satış</button><button onClick={() => setScreen('products')}><Store/> Ürün düzenle</button><button onClick={() => setScreen('history')}><CalendarDays/> Günlük rapor</button></div></div>
        </section>}

        {screen === 'tables' && <section>
          <div className="page-heading"><div><div className="eyebrow">SİPARİŞ YÖNETİMİ</div><h1>Masalarım</h1><p>Masaları seçerek sipariş açın, hesabı görüntüleyin veya ödeme alın.</p></div><div className="heading-actions"><input className="table-name-input" value={tableName} onChange={e => setTableName(e.target.value)} placeholder="Yeni masa adı"/><button className="primary" onClick={addTable}><Plus size={17}/> Masa Ekle</button></div></div>
          <div className="legend"><span><i className="free-dot"></i> Boş masa</span><span><i className="busy-dot"></i> Sipariş açık</span><span>{tables.length} masa tanımlı</span></div>
          <div className="table-grid">{tables.map(t => { const o = openOrders.find(x => x.tableId === t.id); return <div className={'table-card ' + (o ? 'is-busy' : '')} key={t.id}>
            <div className="table-card-top"><span className={'table-status ' + (o ? 'busy' : 'free')}>{o ? 'SİPARİŞ AÇIK' : 'BOŞ'}</span><button className="icon-btn" title="Masayı sil" onClick={() => removeTable(t.id)}><Trash2 size={16}/></button></div>
            <div className="table-illustration"><Utensils size={29}/></div><h3>{t.name}</h3>
            {o ? <><b className="table-amount">{money(o.total)}</b><small>{o.items.reduce((s, x) => s + x.qty, 0)} ürün • {dateText(o.createdAt)}</small><button className="outline-btn" onClick={() => beginTable(t)}>Siparişi Aç</button><div className="close-actions"><button onClick={() => closeOrder(o, 'paid')}><Check size={14}/> Ödendi</button><button onClick={() => closeOrder(o, 'cancelled')}><X size={14}/> İptal</button></div></>
            : <><p className="muted">Henüz sipariş yok</p><button className="primary full" onClick={() => beginTable(t)}>Sipariş Oluştur <span>→</span></button></>}
          </div>; })}</div>
        </section>}

        {screen === 'pos' && <section className="pos-section">
          <div className="page-heading"><div><div className="eyebrow">YENİ SİPARİŞ</div><h1>{walkin ? 'Ayaküstü Satış' : (tables.find(t => t.id === selectedTable)?.name || 'Masa Siparişi')}</h1><p>Ürün seçin ve siparişi kaydedin.</p></div><button className="outline-btn" onClick={() => { setCart([]); setScreen(walkin ? 'walkin' : 'tables'); }}>← Geri</button></div>
          <div className="pos-layout"><div className="product-browser">
            <div className="product-toolbar"><div className="category-tabs"><button className={category === 'all' ? 'selected' : ''} onClick={() => setCategory('all')}>Tümü</button>{categories.map(c => <button className={category === c.id ? 'selected' : ''} key={c.id} onClick={() => setCategory(c.id)}>{c.name}</button>)}</div><div className="search-box"><Search size={16}/><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Ürün ara..."/></div></div>
            <div className="product-grid">{activeProducts.map(p => <button className="product-card" key={p.id} onClick={() => addToCart(p)}><div className="product-symbol">{p.categoryId === 'drinks' ? <Coffee/> : <Utensils/>}</div><b>{p.name}</b><small>{p.description || 'TOBU lezzeti'}</small><strong>{money(p.price)}</strong><span className="add-product"><Plus size={15}/></span></button>)}
              {!activeProducts.length && <div className="empty-state">Bu kategoride ürün bulunamadı.</div>}</div>
          </div><aside className="cart-panel"><div className="cart-title"><div><h2>Sipariş Özeti</h2><p>{cart.reduce((s, x) => s + x.qty, 0)} ürün</p></div><ShoppingBag/></div>
            <div className="cart-lines">{cart.map(line => <div className="cart-line" key={line.productId}><div className="line-info"><b>{line.name}</b><small>{money(line.price)} / adet</small></div><div className="qty-control"><button onClick={() => updateQty(line.productId, -1)}><Minus size={13}/></button><b>{line.qty}</b><button onClick={() => updateQty(line.productId, 1)}><Plus size={13}/></button></div><strong>{money(line.price * line.qty)}</strong></div>)}
              {!cart.length && <div className="empty-state"><ShoppingBag size={25}/><b>Sepetiniz boş</b><span>Ürünlere tıklayarak sipariş ekleyin.</span></div>}</div>
            <div className="cart-total"><span>Genel toplam</span><strong>{money(cart.reduce((s, x) => s + x.price * x.qty, 0))}</strong></div>
            <button className="primary full checkout" disabled={!cart.length} onClick={saveOrder}>{walkin ? 'Satışı Tamamla' : 'Siparişi Masaya Kaydet'} <span>→</span></button>
            {walkin && <small className="cart-note">Ayaküstü satış tamamlandığında doğrudan ödenmiş olarak kaydedilir.</small>}
          </aside></div>
        </section>}

        {screen === 'walkin' && <section>
          <div className="page-heading"><div><div className="eyebrow">HIZLI SATIŞ</div><h1>Ayaküstü Satış</h1><p>Masa kullanmadan yapılan satışları buradan kaydedin.</p></div><button className="primary" onClick={beginWalkin}><Plus size={17}/> Yeni Ayaküstü Satış</button></div>
          <div className="stat-grid single-stat"><div className="stat-card"><div className="stat-icon gold"><Wallet/></div><span>Bugünkü ayaküstü cirosu</span><strong>{money(todayOrders.filter(o => o.kind === 'walkin').reduce((s, o) => s + o.total, 0))}</strong></div><div className="stat-card"><div className="stat-icon blue"><ShoppingBag/></div><span>Bugünkü ayaküstü işlem</span><strong>{todayOrders.filter(o => o.kind === 'walkin').length}</strong></div></div>
          <div className="panel"><div className="panel-head"><div><h2>Son ayaküstü satışlar</h2><p>Tamamlanan hızlı satışlar.</p></div></div><OrderTable orders={orders.filter(o => o.kind === 'walkin').slice(0, 10)} /></div>
        </section>}

        {screen === 'products' && <section>
          <div className="page-heading"><div><div className="eyebrow">MENÜ YÖNETİMİ</div><h1>Ürünlerim</h1><p>Kategorilerinizi ve ürün bilgilerinizi düzenleyin.</p></div><button className="primary" onClick={() => setEditor({ id: uid(), categoryId: categories[0]?.id || '', name: '', description: '', price: 0, active: true })}><Plus size={17}/> Ürün Ekle</button></div>
          <div className="panel category-manager"><div><h2>Kategoriler</h2><p>Ürünlerinizi gruplandırın.</p></div><div className="category-add"><input value={newCategory} onChange={e => setNewCategory(e.target.value)} placeholder="Yeni kategori adı"/><button className="outline-btn" onClick={addCategory}><Plus size={15}/> Kategori Ekle</button></div><div className="category-chips">{categories.map(c => <span key={c.id}>{c.name}<small>{products.filter(p => p.categoryId === c.id && p.active).length} ürün</small></span>)}</div></div>
          {categories.map(c => <div className="panel product-manage-panel" key={c.id}><div className="panel-head"><div><h2>{c.name}</h2><p>{products.filter(p => p.categoryId === c.id && p.active).length} aktif ürün</p></div></div>
            <div className="manage-list">{products.filter(p => p.categoryId === c.id && p.active).map(p => <div className="manage-row" key={p.id}><div className="manage-product-icon">{c.id === 'drinks' ? <Coffee/> : <Utensils/>}</div><div className="manage-product-info"><b>{p.name}</b><small>{p.description || 'Açıklama eklenmemiş'}</small></div><strong>{money(p.price)}</strong><button className="outline-btn small-btn" onClick={() => setEditor({ ...p })}><Settings2 size={14}/> Düzenle</button><button className="icon-btn danger" onClick={() => deleteProduct(p.id)} title="Ürünü pasife al"><Trash2 size={16}/></button></div>)}
              {!products.some(p => p.categoryId === c.id && p.active) && <div className="empty-state compact">Bu kategoride aktif ürün yok.</div>}</div>
          </div>)}
          {editor && <div className="modal-backdrop" onClick={() => setEditor(null)}><div className="modal" onClick={e => e.stopPropagation()}><div className="modal-head"><div><div className="eyebrow">ÜRÜN BİLGİSİ</div><h2>{products.some(p => p.id === editor.id) ? 'Ürünü Düzenle' : 'Yeni Ürün'}</h2></div><button className="icon-btn" onClick={() => setEditor(null)}><X/></button></div>
            <label>Ürün adı<input value={editor.name} onChange={e => setEditor({ ...editor, name: e.target.value })} placeholder="Ürün adı"/></label>
            <label>Kategori<select value={editor.categoryId} onChange={e => setEditor({ ...editor, categoryId: e.target.value })}>{categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label>
            <label>Açıklama<input value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} placeholder="Ürün açıklaması"/></label>
            <label>Fiyat (TL)<input type="number" min="0" step="1" value={editor.price} onChange={e => setEditor({ ...editor, price: Number(e.target.value) })}/></label>
            <div className="modal-actions"><button className="outline-btn" onClick={() => setEditor(null)}>Vazgeç</button><button className="primary" onClick={saveProduct}>Kaydet</button></div>
          </div></div>}
        </section>}

        {screen === 'history' && <section>
          <div className="page-heading"><div><div className="eyebrow">KASA VE RAPORLAMA</div><h1>Satış Geçmişi</h1><p>Ödenen ve iptal edilen tüm işlemleri tarihe göre inceleyin.</p></div><div className="date-filter"><CalendarDays size={17}/><input type="date" value={historyDate} onChange={e => setHistoryDate(e.target.value)}/></div></div>
          <div className="stat-grid single-stat"><div className="stat-card"><div className="stat-icon gold"><Wallet/></div><span>Seçili günün cirosu</span><strong>{money(historyTotal)}</strong></div><div className="stat-card"><div className="stat-icon green"><Check/></div><span>Ödenen işlem</span><strong>{displayedHistory.filter(o => o.status === 'paid').length}</strong></div><div className="stat-card"><div className="stat-icon orange"><X/></div><span>İptal edilen işlem</span><strong>{displayedHistory.filter(o => o.status === 'cancelled').length}</strong></div></div>
          <div className="panel"><div className="panel-head"><div><h2>{new Date(historyDate + 'T12:00:00').toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })} işlemleri</h2><p>Masalara ve ayaküstü satışlara göre kayıtlar.</p></div></div><OrderTable orders={displayedHistory}/></div>
          <div className="panel"><div className="panel-head"><div><h2>Masa bazında kazanç</h2><p>Seçili tarihte her masanın oluşturduğu ciro.</p></div></div>
            <div className="table-revenue">{tables.map(t => { const total = displayedHistory.filter(o => o.status === 'paid' && o.tableId === t.id).reduce((s, o) => s + o.total, 0); return <div key={t.id}><span>{t.name}</span><b>{money(total)}</b></div>; })}{(() => { const total = displayedHistory.filter(o => o.status === 'paid' && o.kind === 'walkin').reduce((s, o) => s + o.total, 0); return <div><span>Ayaküstü</span><b>{money(total)}</b></div>; })()}</div>
          </div>
        </section>}
      </div>
    </main>
  </div>;
}

function OrderTable({ orders }: { orders: Order[] }) {
  if (!orders.length) return <div className="empty-state">Seçilen tarihte kayıt bulunmuyor.</div>;
  return <div className="table-wrap"><table><thead><tr><th>İŞLEM</th><th>ÜRÜNLER</th><th>TARİH</th><th>TUTAR</th><th>DURUM</th></tr></thead><tbody>{orders.map(o => <tr key={o.id}><td><b>{o.tableName || 'Ayaküstü'}</b><small className="cell-sub">{o.kind === 'table' ? 'Masa siparişi' : 'Hızlı satış'}</small></td><td>{o.items.map(i => i.name + ' × ' + i.qty).join(', ')}</td><td>{dateText(o.closedAt || o.createdAt)}</td><td><b>{money(o.total)}</b></td><td><span className={'status-pill ' + o.status}>{o.status === 'paid' ? 'Ödendi' : o.status === 'cancelled' ? 'İptal' : 'Açık'}</span></td></tr>)}</tbody></table></div>;
}
