import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Building2, CheckCircle2, CircleAlert, LogOut, MapPin, Plus, RefreshCw, ShieldCheck, Store, Users, Wifi, WifiOff, ShoppingCart, PackagePlus, Search, Minus, Trash2, Receipt, CreditCard } from 'lucide-react';
import { supabase } from './lib/supabase';

type Profile = { user_id: string; display_name: string; username: string | null; role: 'central_admin' | 'branch_manager' | 'cashier'; branch_id: string | null; is_active: boolean };
type City = { id: number; name: string; plate_code: number };
type Branch = { id: string; city_id: number; branch_code: string; branch_name: string; is_enabled: boolean; address: string | null; phone: string | null; notes: string | null; cities?: City };
type Presence = { branch_id: string; status: string; last_seen_at: string };
type Staff = { user_id: string; display_name: string; username: string | null; role: string; branch_id: string | null; is_active: boolean };
type Order = { id: string; branch_id: string; order_number: number; order_type: string; table_number: number | null; total: number; status: string; payment_method: string | null; created_at: string; paid_at: string | null; cancelled_at: string | null; cancellation_reason: string | null };
type OrderItem = { id: string; product_name: string; quantity: number; cancelled_quantity: number; unit_price: number; line_total: number };
type OrderCancellation = { id: string; action_type: string; product_name: string | null; quantity: number | null; amount: number; reason: string; created_at: string };
type Category = { id: string; name: string; sort_order: number; is_active: boolean };
type Product = { id: string; category_id: string | null; name: string; description: string | null; base_price: number; is_active: boolean; sort_order: number };
type BranchProduct = { branch_id: string; product_id: string; is_available: boolean; sale_price: number | null };
type CartLine = { product: Product; quantity: number };
type Expense = { branch_id: string; amount: number; expense_date: string };
const money = (v: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 }).format(v || 0);
const dateKey = () => new Date().toLocaleDateString('en-CA');
const deviceId = () => {
  let id = localStorage.getItem('tobu:device');
  if (!id) { id = crypto.randomUUID(); localStorage.setItem('tobu:device', id); }
  return id;
};

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [sessionUser, setSessionUser] = useState<string | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<'overview' | 'branches' | 'staff' | 'pos' | 'menu'>('overview');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [branchProducts, setBranchProducts] = useState<BranchProduct[]>([]);
  const [cart, setCart] = useState<CartLine[]>([]);
  const [posBranchId, setPosBranchId] = useState('');
  const [posCategory, setPosCategory] = useState('all');
  const [posSearch, setPosSearch] = useState('');
  const [orderType, setOrderType] = useState('counter');
  const [tableNumber, setTableNumber] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('cash');
  const [saleNote, setSaleNote] = useState('');
  const [categoryName, setCategoryName] = useState('');
  const [productForm, setProductForm] = useState({ name: '', category_id: '', base_price: '', description: '' });
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedItems, setSelectedItems] = useState<OrderItem[]>([]);
  const [selectedCancellations, setSelectedCancellations] = useState<OrderCancellation[]>([]);
  const [cancelReason, setCancelReason] = useState('');
  const [cancelItemId, setCancelItemId] = useState('');
  const [cancelQuantity, setCancelQuantity] = useState('1');
  const [branchForm, setBranchForm] = useState({ city_id: '', branch_code: '', branch_name: '', address: '', phone: '', notes: '' });
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null);
  const [branchEditForm, setBranchEditForm] = useState({ city_id: '', branch_code: '', branch_name: '', address: '', phone: '', notes: '' });
  const [staffForm, setStaffForm] = useState({ username: '', password: '', display_name: '', role: 'cashier', branch_id: '' });

  const isCentral = profile?.role === 'central_admin';
  const myBranch = branches.find(b => b.id === profile?.branch_id);
  const todayOrderHistory = orders.filter(o => ['paid','cancelled'].includes(o.status) && (o.paid_at || o.created_at).slice(0, 10) === dateKey());
  const todayOrders = todayOrderHistory.filter(o => o.status === 'paid');
  const activePosBranch = isCentral ? branches.find(b => b.id === posBranchId) : myBranch;
  const posBranchProducts = branchProducts.filter(x => x.branch_id === activePosBranch?.id);
  const visibleProducts = products.filter(p => p.is_active && (posCategory === 'all' || p.category_id === posCategory) && p.name.toLocaleLowerCase('tr').includes(posSearch.toLocaleLowerCase('tr')) && (!posBranchProducts.some(x => x.product_id === p.id) || posBranchProducts.find(x => x.product_id === p.id)?.is_available !== false));
  const cartTotal = cart.reduce((sum, line) => sum + line.quantity * Number(posBranchProducts.find(x => x.product_id === line.product.id)?.sale_price ?? line.product.base_price), 0);
  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const todayExpenses = expenses.filter(e => e.expense_date === dateKey()).reduce((sum, e) => sum + Number(e.amount), 0);
  const onlineCount = useMemo(() => branches.filter(b => {
    const p = presence.filter(x => x.branch_id === b.id).sort((a, z) => z.last_seen_at.localeCompare(a.last_seen_at))[0];
    return b.is_enabled && !!p && p.status === 'online' && Date.now() - new Date(p.last_seen_at).getTime() < 90000;
  }).length, [branches, presence]);

  const loadData = useCallback(async (p: Profile) => {
    const branchFilter = !isCentral && p.branch_id ? p.branch_id : undefined;
    let branchQuery = supabase.from('branches').select('id,city_id,branch_code,branch_name,is_enabled,address,phone,notes,cities(id,name,plate_code)').order('branch_name');
    if (branchFilter) branchQuery = branchQuery.eq('id', branchFilter);
    const [b, c, pr, st, o, ex, cats, prods, bp] = await Promise.all([
      branchQuery,
      supabase.from('cities').select('id,name,plate_code').order('plate_code'),
      supabase.from('branch_presence').select('branch_id,status,last_seen_at').order('last_seen_at', { ascending: false }),
      supabase.from('staff_profiles').select('user_id,display_name,username,role,branch_id,is_active').order('display_name'),
      (() => { let q = supabase.from('orders').select('id,branch_id,order_number,order_type,table_number,total,status,payment_method,created_at,paid_at,cancelled_at,cancellation_reason').order('created_at', { ascending: false }).limit(500); if (branchFilter) q = q.eq('branch_id', branchFilter); return q; })(),
      (() => { let q = supabase.from('expenses').select('branch_id,amount,expense_date').order('expense_date', { ascending: false }).limit(500); if (branchFilter) q = q.eq('branch_id', branchFilter); return q; })(),
      supabase.from('categories').select('id,name,sort_order,is_active').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('id,category_id,name,description,base_price,is_active,sort_order').order('sort_order').order('name'),
      (() => { let q = supabase.from('branch_products').select('branch_id,product_id,is_available,sale_price'); if (branchFilter) q = q.eq('branch_id', branchFilter); return q; })()
    ]);
    const firstError = b.error || c.error || pr.error || st.error || o.error || ex.error || cats.error || prods.error || bp.error;
    if (firstError) throw firstError;
    setBranches((b.data || []) as unknown as Branch[]);
    setCities((c.data || []) as City[]);
    setPresence((pr.data || []) as Presence[]);
    setStaff((st.data || []) as Staff[]);
    setOrders((o.data || []) as Order[]);
    setExpenses((ex.data || []) as Expense[]);
    setCategories((cats.data || []) as Category[]);
    setProducts((prods.data || []) as Product[]);
    setBranchProducts((bp.data || []) as BranchProduct[]);
    if (!posBranchId && p.branch_id) setPosBranchId(p.branch_id);
  }, [isCentral]);

  const refresh = useCallback(async () => {
    if (!profile) return;
    try { await loadData(profile); } catch (e) { setError(e instanceof Error ? e.message : 'Veriler alınamadı.'); }
  }, [profile, loadData]);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (!data.session) { if (alive) setLoading(false); return; }
      const { data: row, error: profileError } = await supabase.from('staff_profiles').select('*').eq('user_id', data.session.user.id).single();
      if (profileError || !row || !row.is_active) {
        await supabase.auth.signOut();
        if (alive) { setError('Bu kullanıcı için aktif TOBU personel yetkisi bulunamadı.'); setLoading(false); }
        return;
      }
      if (row.branch_id) {
        const { data: branch } = await supabase.from('branches').select('is_enabled').eq('id', row.branch_id).single();
        if (!branch?.is_enabled) {
          await supabase.auth.signOut();
          if (alive) { setError('Bu şube merkez yönetim tarafından devre dışı bırakılmış.'); setLoading(false); }
          return;
        }
      }
      if (alive) { setProfile(row as Profile); setSessionUser(data.session.user.id); }
    })().catch(e => { if (alive) setError(e instanceof Error ? e.message : 'Oturum kontrol edilemedi.'); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  useEffect(() => { if (profile) refresh(); }, [profile, refresh]);

  useEffect(() => {
    if (!profile?.branch_id || !sessionUser) return;
    const branchId = profile.branch_id;
    const id = deviceId();
    const heartbeat = async () => {
      const { error: e } = await supabase.from('branch_presence').upsert({
        branch_id: branchId, user_id: sessionUser, device_id: id, status: 'online',
        last_seen_at: new Date().toISOString(), logged_out_at: null
      }, { onConflict: 'branch_id,user_id,device_id' });
      if (e) console.warn('TOBU heartbeat:', e.message);
    };
    heartbeat();
    const timer = window.setInterval(heartbeat, 30000);
    return () => window.clearInterval(timer);
  }, [profile?.branch_id, sessionUser]);

  async function login(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    const value = username.trim().toLowerCase();
    const email = value.includes('@') ? value : value + '@tobu.local';
    const { error: e2 } = await supabase.auth.signInWithPassword({ email, password });
    if (e2) setError('Kullanıcı adı veya şifre hatalı.');
    else window.location.reload();
    setBusy(false);
  }

  async function logout() {
    if (profile?.branch_id && sessionUser) {
      await supabase.from('branch_presence').update({ status: 'offline', logged_out_at: new Date().toISOString(), last_seen_at: new Date().toISOString() })
        .eq('branch_id', profile.branch_id).eq('user_id', sessionUser).eq('device_id', deviceId());
    }
    await supabase.auth.signOut(); setProfile(null); setSessionUser(null);
  }

  async function createBranch(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    const { error: e2 } = await supabase.from('branches').insert({
      city_id: Number(branchForm.city_id), branch_code: branchForm.branch_code.trim().toUpperCase(),
      branch_name: branchForm.branch_name.trim(), address: branchForm.address.trim() || null,
      phone: branchForm.phone.trim() || null, notes: branchForm.notes.trim() || null
    });
    if (e2) setError(e2.message);
    else { setNotice('Şube oluşturuldu.'); setBranchForm({ city_id: '', branch_code: '', branch_name: '', address: '', phone: '', notes: '' }); await refresh(); }
    setBusy(false);
  }

  async function createStaff(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    const cleanUsername = staffForm.username.trim().toLowerCase();
    if (!/^[a-z0-9._-]{3,40}$/.test(cleanUsername)) {
      setError('Kullanıcı adı 3-40 karakter olmalı; yalnızca İngilizce harf, rakam, nokta, tire ve alt çizgi kullanın. E-posta adresi girmeyin.');
      setBusy(false);
      return;
    }
    try {
      const { data, error: invokeError } = await supabase.functions.invoke('create-branch-user', {
        body: { username: cleanUsername, password: staffForm.password, display_name: staffForm.display_name.trim(), role: staffForm.role, branch_id: staffForm.branch_id }
      });
      if (invokeError) {
        let detail = invokeError.message;
        const context = (invokeError as { context?: Response }).context;
        if (context) {
          try { const payload = await context.clone().json(); if (payload?.error) detail = payload.error; } catch { /* keep the original message */ }
        }
        throw new Error(detail);
      }
      if (data?.error) throw new Error(data.error);
      setNotice('Şube kullanıcı hesabı oluşturuldu.');
      setStaffForm({ username: '', password: '', display_name: '', role: 'cashier', branch_id: '' });
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Şube kullanıcısı oluşturulamadı.');
    } finally {
      setBusy(false);
    }
  }

  async function createCategory(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    const name = categoryName.trim();
    if (!name) { setBusy(false); return; }
    const { error: e2 } = await supabase.from('categories').insert({ name, sort_order: categories.length });
    if (e2) setError(e2.message); else { setNotice('Kategori oluşturuldu.'); setCategoryName(''); await refresh(); }
    setBusy(false);
  }

  async function createProduct(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(''); setNotice('');
    const price = Number(productForm.base_price);
    if (!productForm.name.trim() || !Number.isFinite(price) || price < 0) { setError('Ürün adı ve geçerli bir fiyat girin.'); setBusy(false); return; }
    const { error: e2 } = await supabase.from('products').insert({ name: productForm.name.trim(), category_id: productForm.category_id || null, base_price: price, description: productForm.description.trim() || null, sort_order: products.length, is_active: true });
    if (e2) setError(e2.message); else { setNotice('Ürün menüye eklendi.'); setProductForm({ name: '', category_id: '', base_price: '', description: '' }); await refresh(); }
    setBusy(false);
  }

  function addToCart(product: Product) { setCart(current => { const found = current.find(x => x.product.id === product.id); return found ? current.map(x => x.product.id === product.id ? { ...x, quantity: x.quantity + 1 } : x) : [...current, { product, quantity: 1 }]; }); }
  function changeCartQuantity(productId: string, delta: number) { setCart(current => current.map(x => x.product.id === productId ? { ...x, quantity: x.quantity + delta } : x).filter(x => x.quantity > 0)); }

  async function completeSale() {
    if (!activePosBranch) { setError('Önce satış yapılacak şubeyi seçin.'); return; }
    if (!cart.length) { setError('Sepet boş. Önce ürün ekleyin.'); return; }
    if (orderType === 'table' && (!tableNumber || Number(tableNumber) < 1)) { setError('Geçerli bir masa numarası girin.'); return; }
    setBusy(true); setError(''); setNotice('');
    const { data, error: saleError } = await supabase.rpc('tobu_create_order', { p_branch_id: activePosBranch.id, p_order_type: orderType, p_table_number: orderType === 'table' ? Number(tableNumber) : null, p_payment_method: paymentMethod, p_note: saleNote, p_items: cart.map(x => ({ product_id: x.product.id, quantity: x.quantity })) });
    if (saleError) setError(saleError.message);
    else { setNotice('Satış tamamlandı. Sipariş kaydı: ' + String(data).slice(0, 8)); setCart([]); setTableNumber(''); setSaleNote(''); await refresh(); }
    setBusy(false);
  }

  async function openOrder(order: Order) {
    setSelectedOrder(order); setSelectedItems([]); setCancelReason(''); setCancelItemId(''); setCancelQuantity('1');
    const [itemsResult, auditResult] = await Promise.all([
      supabase.from('order_items').select('id,product_name,quantity,cancelled_quantity,unit_price,line_total').eq('order_id', order.id).order('created_at'),
      isCentral ? supabase.from('order_cancellations').select('id,action_type,product_name,quantity,amount,reason,created_at').eq('order_id', order.id).order('created_at', { ascending: false }) : Promise.resolve({ data: [], error: null })
    ]);
    if (itemsResult.error || auditResult.error) { setError(itemsResult.error?.message || auditResult.error?.message || 'Satış ayrıntıları alınamadı.'); setSelectedOrder(null); return; }
    setSelectedItems((itemsResult.data || []) as OrderItem[]);
    setSelectedCancellations((auditResult.data || []) as OrderCancellation[]);
  }

  async function cancelWholeOrder() {
    if (!selectedOrder || !cancelReason.trim()) { setError('İptal nedeni girin.'); return; }
    if (!window.confirm('Bu satışın tamamını iptal etmek istediğinize emin misiniz?')) return;
    setBusy(true); setError(''); setNotice('');
    const { error: e } = await supabase.rpc('tobu_cancel_order', { p_order_id: selectedOrder.id, p_reason: cancelReason.trim() });
    if (e) setError(e.message); else { setNotice('Satışın tamamı iptal edildi. İşlem denetim kaydına eklendi.'); setSelectedOrder(null); await refresh(); }
    setBusy(false);
  }

  async function cancelOneItem() {
    if (!selectedOrder || !cancelItemId || !cancelReason.trim()) { setError('Ürün ve iptal nedeni seçin.'); return; }
    const qty = Number(cancelQuantity);
    if (!Number.isFinite(qty) || qty <= 0) { setError('Geçerli iptal miktarı girin.'); return; }
    setBusy(true); setError(''); setNotice('');
    const { error: e } = await supabase.rpc('tobu_cancel_order_item', { p_order_item_id: cancelItemId, p_quantity: qty, p_reason: cancelReason.trim() });
    if (e) setError(e.message); else { setNotice('Seçilen ürün miktarı iptal edildi.'); setSelectedOrder(null); await refresh(); }
    setBusy(false);
  }

  async function toggleProduct(product: Product) {
    const { error: e } = await supabase.from('products').update({ is_active: !product.is_active }).eq('id', product.id);
    if (e) setError(e.message); else { setNotice(product.is_active ? 'Ürün satışa kapatıldı.' : 'Ürün yeniden satışa açıldı.'); await refresh(); }
  }

  function startBranchEdit(branch: Branch) {
    setEditingBranch(branch);
    setBranchEditForm({ city_id: String(branch.city_id), branch_code: branch.branch_code, branch_name: branch.branch_name, address: branch.address || '', phone: branch.phone || '', notes: branch.notes || '' });
    setError(''); setNotice('');
  }

  async function updateBranch(e: React.FormEvent) {
    e.preventDefault();
    if (!editingBranch) return;
    if (!branchEditForm.city_id || !branchEditForm.branch_code.trim() || !branchEditForm.branch_name.trim()) {
      setError('İl, şube kodu ve şube adı zorunludur.'); return;
    }
    setBusy(true); setError(''); setNotice('');
    const { error: updateError } = await supabase.from('branches').update({
      city_id: Number(branchEditForm.city_id),
      branch_code: branchEditForm.branch_code.trim().toUpperCase(),
      branch_name: branchEditForm.branch_name.trim(),
      address: branchEditForm.address.trim() || null,
      phone: branchEditForm.phone.trim() || null,
      notes: branchEditForm.notes.trim() || null,
      updated_at: new Date().toISOString()
    }).eq('id', editingBranch.id);
    if (updateError) setError(updateError.message);
    else { setNotice('Şube bilgileri güncellendi.'); setEditingBranch(null); await refresh(); }
    setBusy(false);
  }

  async function toggleBranch(branch: Branch) {
    const { error: e } = await supabase.from('branches').update({ is_enabled: !branch.is_enabled }).eq('id', branch.id);
    if (e) setError(e.message); else { setNotice(branch.is_enabled ? 'Şube devre dışı bırakıldı.' : 'Şube yeniden etkinleştirildi.'); await refresh(); }
  }

  if (loading) return <div className="loading-screen"><div className="tobu-logo">T</div><b>TOBU</b><span>Merkezi işletme sistemi yükleniyor…</span></div>;

  if (!profile) return <main className="login-screen">
    <div className="login-panel">
      <div className="brand-lockup"><div className="tobu-logo">T</div><div><b>TOBU</b><small>MERKEZİ ŞUBE YÖNETİMİ</small></div></div>
      <div className="login-kicker">GÜVENLİ PERSONEL GİRİŞİ</div><h1>Hoş geldiniz.</h1><p>Şubenizin veya merkez yönetim hesabınızın bilgileriyle giriş yapın.</p>
      <form onSubmit={login}>
        <label>E-posta veya şube kullanıcı adı<input value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" placeholder="Merkez: e-posta • Şube: kullanıcı adı" required /></label>
        <label>Şifre<input type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" placeholder="Şifreniz" required /></label>
        {error && <div className="alert error"><CircleAlert size={16}/>{error}</div>}
        <button className="btn primary full" disabled={busy}>{busy ? 'Giriş yapılıyor…' : 'Giriş Yap'} <span>→</span></button>
      </form>
      <div className="login-security"><ShieldCheck size={15}/> Şifreli bağlantı ve rol tabanlı erişim</div>
    </div>
    <footer>TOBU • TÜRKİYE GENELİ FRANCHISE YÖNETİMİ</footer>
  </main>;

  const statusFor = (branch: Branch) => {
    if (!branch.is_enabled) return { label: 'Devre dışı', kind: 'disabled', icon: <CircleAlert size={14}/> };
    const p = presence.filter(x => x.branch_id === branch.id).sort((a, b) => b.last_seen_at.localeCompare(a.last_seen_at))[0];
    if (!p || p.status === 'offline') return { label: 'Çevrimdışı', kind: 'offline', icon: <WifiOff size={14}/> };
    if (p.status === 'connection_lost' || Date.now() - new Date(p.last_seen_at).getTime() > 90000) return { label: 'Bağlantı koptu', kind: 'lost', icon: <CircleAlert size={14}/> };
    return { label: 'Çevrimiçi', kind: 'online', icon: <Wifi size={14}/> };
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand-lockup side"><div className="tobu-logo">T</div><div><b>TOBU</b><small>FRANCHISE PLATFORM</small></div></div>
      <div className="nav-caption">YÖNETİM</div>
      <button className={'nav-link ' + (tab === 'overview' ? 'active' : '')} onClick={() => setTab('overview')}><Activity size={18}/> Genel Bakış</button>
      <button className={'nav-link ' + (tab === 'pos' ? 'active' : '')} onClick={() => setTab('pos')}><ShoppingCart size={18}/> POS / Satış</button>
      {isCentral && <button className={'nav-link ' + (tab === 'menu' ? 'active' : '')} onClick={() => setTab('menu')}><PackagePlus size={18}/> Menü Yönetimi</button>}
      {isCentral && <button className={'nav-link ' + (tab === 'branches' ? 'active' : '')} onClick={() => setTab('branches')}><Building2 size={18}/> Şubeler</button>}
      {isCentral && <button className={'nav-link ' + (tab === 'staff' ? 'active' : '')} onClick={() => setTab('staff')}><Users size={18}/> Kullanıcılar</button>}
      <div className="sidebar-bottom">
        <div className="signed-user"><div className="user-avatar">{profile.display_name.slice(0,1).toLocaleUpperCase('tr')}</div><div><b>{profile.display_name}</b><small>{isCentral ? 'Merkez yönetim' : myBranch?.branch_name || 'Şube personeli'}</small></div></div>
        <button className="nav-link logout" onClick={logout}><LogOut size={17}/> Oturumu Kapat</button>
        <small className="build-label">TOBU PLATFORM • v2.0</small>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="crumb">TOBU / </span><b>{tab === 'overview' ? 'Genel Bakış' : tab === 'branches' ? 'Şube Yönetimi' : tab === 'staff' ? 'Kullanıcı Yönetimi' : tab === 'pos' ? 'POS / Satış' : 'Menü Yönetimi'}</b><small>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small></div><div className="topbar-actions"><span className="secure"><ShieldCheck size={15}/> Güvenli oturum</span><button className="icon-action" onClick={refresh} title="Yenile"><RefreshCw size={17}/></button></div></header>
      <div className="content">
        {error && <div className="alert error"><CircleAlert size={16}/>{error}<button onClick={() => setError('')}>×</button></div>}
        {notice && <div className="alert success"><CheckCircle2 size={16}/>{notice}<button onClick={() => setNotice('')}>×</button></div>}
        {tab === 'overview' && <>
          <div className="page-heading"><div><span className="eyebrow">{isCentral ? 'MERKEZ YÖNETİMİ' : 'ŞUBE OPERASYONU'}</span><h1>{isCentral ? 'Türkiye genelinde kontrol sizde.' : (myBranch?.branch_name || 'Şube paneli')}</h1><p>{isCentral ? 'Tüm şubelerin anlık durumunu, cirosunu ve operasyonlarını tek merkezden yönetin.' : 'Şubenizin günlük operasyon ve performans özeti.'}</p></div><div className="live-pill"><i/> CANLI SİSTEM</div></div>
          <div className="metric-grid">
            <Metric icon={<Store/>} label={isCentral ? 'Toplam Şube' : 'Şube Durumu'} value={isCentral ? String(branches.length) : (myBranch?.is_enabled ? 'Aktif' : 'Pasif')} note={isCentral ? '81 ilde şube yönetimi' : myBranch?.branch_code || 'Şube kodu'} />
            <Metric icon={<Wifi/>} label={isCentral ? 'Çevrimiçi Şube' : 'Bugünkü İşlem'} value={isCentral ? String(onlineCount) : String(todayOrders.length)} note={isCentral ? 'Son 90 saniyede sinyal gönderen' : 'Tamamlanan satış'} />
            <Metric icon={<ArrowUpRight/>} label="Bugünkü Ciro" value={money(todayRevenue)} note="Ödemesi alınmış siparişler" />
            <Metric icon={<ArrowDownRight/>} label="Bugünkü Gider" value={money(todayExpenses)} note="Kaydedilen işletme giderleri" />
          </div>
          {isCentral ? <section className="surface">
            <div className="section-head"><div><h2>Şube ağı</h2><p>Şubelerin son bağlantı durumu ve günlük performansı.</p></div><button className="btn outline" onClick={() => setTab('branches')}>Şubeleri Yönet →</button></div>
            <div className="branch-list">
              {branches.slice(0, 12).map(branch => {
                const s = statusFor(branch);
                const revenue = todayOrders.filter(o => o.branch_id === branch.id).reduce((sum, o) => sum + Number(o.total), 0);
                return <div className="branch-row" key={branch.id}><div className="branch-symbol"><Store size={18}/></div><div className="branch-main"><b>{branch.branch_name}</b><small>{branch.cities?.name || 'İl bilgisi'} • {branch.branch_code}</small></div><span className={'status '+s.kind}>{s.icon}{s.label}</span><strong className="branch-revenue">{money(revenue)}</strong></div>;
              })}
              {!branches.length && <div className="empty">Henüz şube eklenmemiş. Şubeler sekmesinden ilk şubeyi oluşturun.</div>}
            </div>
          </section> : <section className="surface branch-welcome"><div className="welcome-icon"><Store size={28}/></div><div><h2>Şube bağlantısı aktif</h2><p>Merkez yönetiminin belirlediği şube hesabıyla giriş yaptınız. Verileriniz yalnızca bu şubeye özeldir.</p></div><div className="connection"><span/><b>Bağlantı izleniyor</b><small>30 saniyede bir güvenli sinyal</small></div></section>}
        </>}
        {tab === 'branches' && isCentral && <div className="two-col">
          <section className="surface"><div className="section-head"><div><h2>Yeni şube oluştur</h2><p>Türkiye'nin 81 ilinden birinde yeni franchise noktası açın.</p></div></div>
            <form className="stack-form" onSubmit={createBranch}>
              <label>İl<select required value={branchForm.city_id} onChange={e => setBranchForm({ ...branchForm, city_id: e.target.value })}><option value="">İl seçin</option>{cities.map(c => <option key={c.id} value={c.id}>{String(c.plate_code).padStart(2,'0')} • {c.name}</option>)}</select></label>
              <label>Şube kodu<input required value={branchForm.branch_code} onChange={e => setBranchForm({ ...branchForm, branch_code: e.target.value })} placeholder="Örn. MRS-001"/></label>
              <label>Şube adı<input required value={branchForm.branch_name} onChange={e => setBranchForm({ ...branchForm, branch_name: e.target.value })} placeholder="Örn. Mersin Marina"/></label>
              <label>Adres <input value={branchForm.address} onChange={e => setBranchForm({ ...branchForm, address: e.target.value })} placeholder="Şube adresi (isteğe bağlı)"/></label>
              <label>Telefon <input value={branchForm.phone} onChange={e => setBranchForm({ ...branchForm, phone: e.target.value })} placeholder="Şube telefon numarası (isteğe bağlı)"/></label>
              <label>Notlar <textarea value={branchForm.notes} onChange={e => setBranchForm({ ...branchForm, notes: e.target.value })} placeholder="Şubeye özel notlar (isteğe bağlı)" rows={3}/></label>
              <button className="btn primary" disabled={busy}><Plus size={17}/> Şubeyi Kaydet</button>
            </form>
          </section>
          <section className="surface"><div className="section-head"><div><h2>Kayıtlı şubeler</h2><p>{branches.length} şube kayıtlı.</p></div></div>
            {editingBranch && <form className="stack-form branch-edit-form" onSubmit={updateBranch}>
              <div className="section-head"><div><h2>Şube bilgilerini düzenle</h2><p>{editingBranch.branch_name}</p></div><button type="button" className="btn outline mini" onClick={() => setEditingBranch(null)}>Vazgeç</button></div>
              <label>İl<select required value={branchEditForm.city_id} onChange={e => setBranchEditForm({ ...branchEditForm, city_id: e.target.value })}><option value="">İl seçin</option>{cities.map(c => <option key={c.id} value={c.id}>{String(c.plate_code).padStart(2,'0')} • {c.name}</option>)}</select></label>
              <label>Şube kodu<input required value={branchEditForm.branch_code} onChange={e => setBranchEditForm({ ...branchEditForm, branch_code: e.target.value })}/></label>
              <label>Şube adı<input required value={branchEditForm.branch_name} onChange={e => setBranchEditForm({ ...branchEditForm, branch_name: e.target.value })}/></label>
              <label>Adres<input value={branchEditForm.address} onChange={e => setBranchEditForm({ ...branchEditForm, address: e.target.value })}/></label>
              <label>Telefon<input value={branchEditForm.phone} onChange={e => setBranchEditForm({ ...branchEditForm, phone: e.target.value })}/></label>
              <label>Notlar<textarea rows={3} value={branchEditForm.notes} onChange={e => setBranchEditForm({ ...branchEditForm, notes: e.target.value })}/></label>
              <button className="btn primary" disabled={busy}>Değişiklikleri Kaydet</button>
            </form>}
            <div className="branch-list">
              {branches.map(branch => { const s = statusFor(branch); return <div className="branch-row branch-row-wrap" key={branch.id}><div className="branch-symbol"><MapPin size={18}/></div><div className="branch-main"><b>{branch.branch_name}</b><small>{branch.cities?.name} • {branch.branch_code}</small><span className={'status '+s.kind}>{s.icon}{s.label}</span></div><button className="btn mini outline" onClick={() => startBranchEdit(branch)}>Düzenle</button><button className={'btn mini ' + (branch.is_enabled ? 'danger' : 'outline')} onClick={() => toggleBranch(branch)}>{branch.is_enabled ? 'Devre dışı bırak' : 'Etkinleştir'}</button></div>; })}
              {!branches.length && <div className="empty">Şube kaydı bulunmuyor.</div>}
            </div>
          </section>
        </div>}
        {tab === 'pos' && <div className="pos-layout">
          <section className="surface pos-catalog"><div className="section-head"><div><h2>Ürün kataloğu</h2><p>{activePosBranch ? activePosBranch.branch_name : 'Satış için şube seçin'}</p></div></div>
            {isCentral && <label className="pos-branch-select">Satış şubesi<select value={posBranchId} onChange={e => setPosBranchId(e.target.value)}><option value="">Şube seçin</option>{branches.filter(b => b.is_enabled).map(b => <option key={b.id} value={b.id}>{b.branch_name} • {b.branch_code}</option>)}</select></label>}
            <div className="pos-tools"><div className="search-box"><Search size={16}/><input value={posSearch} onChange={e => setPosSearch(e.target.value)} placeholder="Ürün ara…"/></div></div>
            <div className="category-pills"><button className={posCategory === 'all' ? 'selected' : ''} onClick={() => setPosCategory('all')}>Tümü</button>{categories.map(cat => <button key={cat.id} className={posCategory === cat.id ? 'selected' : ''} onClick={() => setPosCategory(cat.id)}>{cat.name}</button>)}</div>
            <div className="product-grid">{visibleProducts.map(product => { const branchPrice = posBranchProducts.find(x => x.product_id === product.id)?.sale_price; return <button className="product-tile" key={product.id} onClick={() => addToCart(product)} disabled={!activePosBranch}><span className="product-tile-icon"><Store size={20}/></span><b>{product.name}</b><strong>{money(Number(branchPrice ?? product.base_price))}</strong><small>Sepete ekle +</small></button>; })}{!visibleProducts.length && <div className="empty pos-empty">{products.length ? 'Bu filtrede satışa açık ürün yok.' : 'Henüz menü ürünü eklenmemiş. Merkez yönetimi Menü Yönetimi bölümünden ürün ekleyebilir.'}</div>}</div>
          </section>
          <section className="surface pos-checkout"><div className="section-head"><div><h2><ShoppingCart size={17}/> Aktif sepet</h2><p>{cart.reduce((n,x)=>n+x.quantity,0)} ürün</p></div><button className="btn mini outline" onClick={() => setCart([])} disabled={!cart.length}>Sepeti temizle</button></div>
            <div className="cart-lines">{cart.map(line => { const price = Number(posBranchProducts.find(x => x.product_id === line.product.id)?.sale_price ?? line.product.base_price); return <div className="cart-line" key={line.product.id}><div className="cart-product"><b>{line.product.name}</b><small>{money(price)} / adet</small></div><div className="qty-control"><button onClick={() => changeCartQuantity(line.product.id,-1)} aria-label="Azalt"><Minus size={13}/></button><b>{line.quantity}</b><button onClick={() => changeCartQuantity(line.product.id,1)} aria-label="Artır"><Plus size={13}/></button></div><strong>{money(price*line.quantity)}</strong><button className="remove-line" onClick={() => setCart(current => current.filter(x => x.product.id !== line.product.id))} aria-label="Ürünü çıkar"><Trash2 size={14}/></button></div>; })}{!cart.length && <div className="empty">Satışa başlamak için soldan ürün seçin.</div>}</div>
            <div className="checkout-fields"><label>Sipariş türü<select value={orderType} onChange={e => setOrderType(e.target.value)}><option value="counter">Kasadan</option><option value="table">Masa</option><option value="takeaway">Gel-al</option><option value="delivery">Paket servis</option></select></label>{orderType === 'table' && <label>Masa numarası<input type="number" min="1" value={tableNumber} onChange={e => setTableNumber(e.target.value)} placeholder="Örn. 4"/></label>}<label>Ödeme yöntemi<select value={paymentMethod} onChange={e => setPaymentMethod(e.target.value)}><option value="cash">Nakit</option><option value="card">Kredi / banka kartı</option><option value="online">Online</option><option value="other">Diğer</option></select></label><label>Not (isteğe bağlı)<input value={saleNote} onChange={e => setSaleNote(e.target.value)} placeholder="Sipariş notu"/></label></div>
            <div className="cart-total"><span>Genel toplam</span><strong>{money(cartTotal)}</strong></div><button className="btn primary full sale-button" onClick={completeSale} disabled={busy || !cart.length || !activePosBranch}><CreditCard size={17}/>{busy ? 'İşleniyor…' : 'Satışı Tamamla'}</button>
          </section>
          <section className="surface pos-history"><div className="section-head"><div><h2><Receipt size={17}/> Bugünkü satışlar</h2><p>{todayOrders.filter(o => !activePosBranch || o.branch_id === activePosBranch.id).length} geçerli satış • İptal edilenler de geçmişte görünür</p></div><strong>{money(todayOrders.filter(o => !activePosBranch || o.branch_id === activePosBranch.id).reduce((sum,o)=>sum+Number(o.total),0))}</strong></div>
            <div className="sales-list">{todayOrderHistory.filter(o => !activePosBranch || o.branch_id === activePosBranch.id).slice(0,20).map(o => <div className={'sale-row '+(o.status === 'cancelled'?'sale-cancelled':'')} key={o.id}><div className="sale-number">#{o.order_number}</div><div className="branch-main"><b>{o.order_type === 'table' ? 'Masa ' + o.table_number : o.order_type === 'takeaway' ? 'Gel-al' : o.order_type === 'delivery' ? 'Paket servis' : 'Kasadan satış'}</b><small>{new Date(o.paid_at || o.created_at).toLocaleTimeString('tr-TR',{hour:'2-digit',minute:'2-digit'})} • {o.payment_method === 'cash' ? 'Nakit' : o.payment_method === 'card' ? 'Kart' : o.payment_method === 'online' ? 'Online' : 'Diğer'}</small></div><strong>{money(Number(o.total))}</strong>{o.status === 'cancelled' ? <span className="cancelled-pill">İptal edildi</span> : <span className="paid-pill">Tamamlandı</span>}<button className="btn mini outline" onClick={() => openOrder(o)}>Detay / İptal</button></div>)}
              {!todayOrderHistory.some(o => !activePosBranch || o.branch_id === activePosBranch.id) && <div className="empty">Bugün henüz satış yok.</div>}
            </div>
          </section></div>}
        {tab === 'menu' && isCentral && <div className="two-col menu-layout">
          <section className="surface"><div className="section-head"><div><h2>Menü kategorisi ekle</h2><p>Ürünleri kategorilere ayırın.</p></div></div><form className="stack-form" onSubmit={createCategory}><label>Kategori adı<input required value={categoryName} onChange={e => setCategoryName(e.target.value)} placeholder="Örn. İçecekler"/></label><button className="btn primary" disabled={busy}><Plus size={16}/> Kategori ekle</button></form><div className="category-admin-list">{categories.map(cat => <span key={cat.id}>{cat.name}</span>)}</div></section>
          <section className="surface"><div className="section-head"><div><h2>Menü ürünü ekle</h2><p>Ürün fiyatı merkez menü fiyatıdır; şube özel fiyatı sonraki aşamada tanımlanabilir.</p></div></div><form className="stack-form" onSubmit={createProduct}><label>Ürün adı<input required value={productForm.name} onChange={e => setProductForm({...productForm,name:e.target.value})} placeholder="Ürün adı"/></label><label>Kategori<select value={productForm.category_id} onChange={e => setProductForm({...productForm,category_id:e.target.value})}><option value="">Kategorisiz</option>{categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}</select></label><label>Satış fiyatı (₺)<input required type="number" min="0" step="0.01" value={productForm.base_price} onChange={e => setProductForm({...productForm,base_price:e.target.value})} placeholder="0,00"/></label><label>Açıklama<input value={productForm.description} onChange={e => setProductForm({...productForm,description:e.target.value})} placeholder="İsteğe bağlı"/></label><button className="btn primary" disabled={busy}><Plus size={16}/> Ürünü kaydet</button></form></section>
          <section className="surface menu-product-list"><div className="section-head"><div><h2>Kayıtlı ürünler</h2><p>{products.length} ürün</p></div></div>{products.map(p => <div className="branch-row" key={p.id}><div className="branch-symbol"><Receipt size={17}/></div><div className="branch-main"><b>{p.name}</b><small>{categories.find(c=>c.id===p.category_id)?.name || 'Kategorisiz'} • {money(Number(p.base_price))}</small></div><button className={'btn mini '+(p.is_active?'danger':'outline')} onClick={()=>toggleProduct(p)}>{p.is_active?'Satışa kapat':'Yeniden aç'}</button></div>)}{!products.length && <div className="empty">Henüz ürün eklenmemiş.</div>}</section>
        </div>}
        {tab === 'staff' && isCentral && <div className="two-col">
          <section className="surface"><div className="section-head"><div><h2>Şube kullanıcısı oluştur</h2><p>Her çalışan için ayrı kullanıcı adı ve parola tanımlayın.</p></div></div>
            <form className="stack-form" onSubmit={createStaff} autoComplete="off">
              <label>Ad soyad<input required name="tobu-staff-display-name" autoComplete="off" value={staffForm.display_name} onChange={e => setStaffForm({ ...staffForm, display_name: e.target.value })} placeholder="Personel adı"/></label>
              <label>Kullanıcı adı<input required name="tobu-new-staff-username" autoComplete="off" data-lpignore="true" data-1p-ignore="true" spellCheck={false} minLength={3} maxLength={40} value={staffForm.username} onChange={e => setStaffForm({ ...staffForm, username: e.target.value.replace(/\s/g,'') })} placeholder="ornek.kullanici (e-posta değil)"/></label>
              <label>İlk parola<input required name="tobu-new-staff-password" autoComplete="new-password" minLength={8} type="password" value={staffForm.password} onChange={e => setStaffForm({ ...staffForm, password: e.target.value })} placeholder="En az 8 karakter"/></label>
              <label>Şube<select required value={staffForm.branch_id} onChange={e => setStaffForm({ ...staffForm, branch_id: e.target.value })}><option value="">Şube seçin</option>{branches.map(b => <option key={b.id} value={b.id}>{b.branch_name} ({b.branch_code})</option>)}</select></label>
              <label>Yetki<select value={staffForm.role} onChange={e => setStaffForm({ ...staffForm, role: e.target.value })}><option value="cashier">Kasiyer</option><option value="branch_manager">Şube yöneticisi</option></select></label>
              <button className="btn primary" disabled={busy || !branches.length}><Users size={17}/> Kullanıcıyı Oluştur</button>
            </form>
            <p className="form-note">Parolalar güvenli kimlik doğrulama sisteminde saklanır; veritabanında açık metin olarak tutulmaz.</p>
          </section>
          <section className="surface"><div className="section-head"><div><h2>Kullanıcı listesi</h2><p>{staff.length} personel hesabı.</p></div></div>
            <div className="branch-list">{staff.map(s => <div className="branch-row" key={s.user_id}><div className="user-avatar small">{s.display_name.slice(0,1).toLocaleUpperCase('tr')}</div><div className="branch-main"><b>{s.display_name}</b><small>{s.username || 'Kullanıcı adı tanımlı değil'} • {branches.find(b => b.id === s.branch_id)?.branch_name || 'Merkez'}</small></div><span className={'status '+(s.is_active?'online':'disabled')}>{s.is_active?'Aktif':'Pasif'}</span></div>)}{!staff.length && <div className="empty">Henüz personel hesabı yok.</div>}</div>
          </section>
        </div>}
      </div>
      {selectedOrder && <div className="modal-backdrop" onClick={() => setSelectedOrder(null)}><section className="surface cancel-modal" onClick={e => e.stopPropagation()}><div className="section-head"><div><span className="eyebrow">SATIŞ DETAYI</span><h2>İşlem #{selectedOrder.order_number}</h2><p>{selectedOrder.status === 'cancelled' ? 'Bu satış iptal edilmiş.' : 'Ürünleri ayrı ayrı veya satışı tamamen iptal edebilirsiniz.'}</p></div><button className="icon-action" onClick={() => setSelectedOrder(null)}>×</button></div>
        <div className="cancel-items">{selectedItems.map(item => { const remaining = Number(item.quantity)-Number(item.cancelled_quantity); return <div className="cancel-item" key={item.id}><div className="branch-main"><b>{item.product_name}</b><small>Satılan: {item.quantity} • Önceden iptal: {item.cancelled_quantity} • Kalan: {remaining}</small></div><strong>{money(Number(item.unit_price)*remaining)}</strong>{selectedOrder.status === 'paid' && remaining > 0 && isCentral && <button className="btn mini danger" onClick={() => {setCancelItemId(item.id);setCancelQuantity(String(remaining));setCancelReason('');}}>Ürünü iptal et</button>}</div>; })}</div>
        {selectedOrder.status === 'cancelled' && <div className="alert error">İptal nedeni: {selectedOrder.cancellation_reason || 'Belirtilmemiş'}</div>}
        {isCentral && selectedCancellations.length > 0 && <div className="cancel-audit"><b>İptal geçmişi</b>{selectedCancellations.map(entry => <div className="audit-row" key={entry.id}><span>{entry.action_type === 'order_cancel' ? 'Satışın tamamı iptal edildi' : (entry.product_name || 'Ürün') + ' • ' + entry.quantity + ' adet iptal'}</span><strong>{money(Number(entry.amount))}</strong><small>{entry.reason} • {new Date(entry.created_at).toLocaleString('tr-TR')}</small></div>)}</div>}
        {selectedOrder.status === 'paid' && isCentral && <div className="cancel-actions"><label>İptal nedeni<input value={cancelReason} onChange={e => setCancelReason(e.target.value)} placeholder="Örn. Müşteri siparişi geri çekti"/></label>{cancelItemId && <label>İptal edilecek miktar<input type="number" min="0.001" step="0.001" max={selectedItems.find(x=>x.id===cancelItemId) ? Number(selectedItems.find(x=>x.id===cancelItemId)!.quantity)-Number(selectedItems.find(x=>x.id===cancelItemId)!.cancelled_quantity) : 1} value={cancelQuantity} onChange={e => setCancelQuantity(e.target.value)}/></label>}<div className="cancel-button-row">{cancelItemId && <button className="btn primary" disabled={busy || cancelReason.trim().length<3} onClick={cancelOneItem}>Seçili miktarı iptal et</button>}<button className="btn danger" disabled={busy || cancelReason.trim().length<3} onClick={cancelWholeOrder}>Satışın tamamını iptal et</button></div></div>}
      </section></div>}
    </main>
  </div>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></article>;
}
