import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, ArrowDownRight, ArrowUpRight, Building2, CheckCircle2, CircleAlert, LogOut, MapPin, Plus, RefreshCw, ShieldCheck, Store, Users, Wifi, WifiOff } from 'lucide-react';
import { supabase } from './lib/supabase';

type Profile = { user_id: string; display_name: string; username: string | null; role: 'central_admin' | 'branch_manager' | 'cashier'; branch_id: string | null; is_active: boolean };
type City = { id: number; name: string; plate_code: number };
type Branch = { id: string; city_id: number; branch_code: string; branch_name: string; is_enabled: boolean; address: string | null; cities?: City };
type Presence = { branch_id: string; status: string; last_seen_at: string };
type Staff = { user_id: string; display_name: string; username: string | null; role: string; branch_id: string | null; is_active: boolean };
type Order = { branch_id: string; total: number; status: string; created_at: string; paid_at: string | null };
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
  const [tab, setTab] = useState<'overview' | 'branches' | 'staff'>('overview');
  const [branches, setBranches] = useState<Branch[]>([]);
  const [presence, setPresence] = useState<Presence[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [cities, setCities] = useState<City[]>([]);
  const [branchForm, setBranchForm] = useState({ city_id: '', branch_code: '', branch_name: '', address: '' });
  const [staffForm, setStaffForm] = useState({ username: '', password: '', display_name: '', role: 'cashier', branch_id: '' });

  const isCentral = profile?.role === 'central_admin';
  const myBranch = branches.find(b => b.id === profile?.branch_id);
  const todayOrders = orders.filter(o => o.status === 'paid' && (o.paid_at || o.created_at).slice(0, 10) === dateKey());
  const todayRevenue = todayOrders.reduce((sum, o) => sum + Number(o.total), 0);
  const todayExpenses = expenses.filter(e => e.expense_date === dateKey()).reduce((sum, e) => sum + Number(e.amount), 0);
  const onlineCount = useMemo(() => branches.filter(b => {
    const p = presence.filter(x => x.branch_id === b.id).sort((a, z) => z.last_seen_at.localeCompare(a.last_seen_at))[0];
    return b.is_enabled && !!p && p.status === 'online' && Date.now() - new Date(p.last_seen_at).getTime() < 90000;
  }).length, [branches, presence]);

  const loadData = useCallback(async (p: Profile) => {
    const branchFilter = !isCentral && p.branch_id ? p.branch_id : undefined;
    let branchQuery = supabase.from('branches').select('id,city_id,branch_code,branch_name,is_enabled,address,cities(id,name,plate_code)').order('branch_name');
    if (branchFilter) branchQuery = branchQuery.eq('id', branchFilter);
    const [b, c, pr, st, o, ex] = await Promise.all([
      branchQuery,
      supabase.from('cities').select('id,name,plate_code').order('plate_code'),
      supabase.from('branch_presence').select('branch_id,status,last_seen_at').order('last_seen_at', { ascending: false }),
      supabase.from('staff_profiles').select('user_id,display_name,username,role,branch_id,is_active').order('display_name'),
      (() => { let q = supabase.from('orders').select('branch_id,total,status,created_at,paid_at').order('created_at', { ascending: false }).limit(500); if (branchFilter) q = q.eq('branch_id', branchFilter); return q; })(),
      (() => { let q = supabase.from('expenses').select('branch_id,amount,expense_date').order('expense_date', { ascending: false }).limit(500); if (branchFilter) q = q.eq('branch_id', branchFilter); return q; })()
    ]);
    const firstError = b.error || c.error || pr.error || st.error || o.error || ex.error;
    if (firstError) throw firstError;
    setBranches((b.data || []) as unknown as Branch[]);
    setCities((c.data || []) as City[]);
    setPresence((pr.data || []) as Presence[]);
    setStaff((st.data || []) as Staff[]);
    setOrders((o.data || []) as Order[]);
    setExpenses((ex.data || []) as Expense[]);
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
      branch_name: branchForm.branch_name.trim(), address: branchForm.address.trim() || null
    });
    if (e2) setError(e2.message);
    else { setNotice('Şube oluşturuldu.'); setBranchForm({ city_id: '', branch_code: '', branch_name: '', address: '' }); await refresh(); }
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
      {isCentral && <button className={'nav-link ' + (tab === 'branches' ? 'active' : '')} onClick={() => setTab('branches')}><Building2 size={18}/> Şubeler</button>}
      {isCentral && <button className={'nav-link ' + (tab === 'staff' ? 'active' : '')} onClick={() => setTab('staff')}><Users size={18}/> Kullanıcılar</button>}
      <div className="sidebar-bottom">
        <div className="signed-user"><div className="user-avatar">{profile.display_name.slice(0,1).toLocaleUpperCase('tr')}</div><div><b>{profile.display_name}</b><small>{isCentral ? 'Merkez yönetim' : myBranch?.branch_name || 'Şube personeli'}</small></div></div>
        <button className="nav-link logout" onClick={logout}><LogOut size={17}/> Oturumu Kapat</button>
        <small className="build-label">TOBU PLATFORM • v2.0</small>
      </div>
    </aside>
    <main className="main-area">
      <header className="topbar"><div><span className="crumb">TOBU / </span><b>{tab === 'overview' ? 'Genel Bakış' : tab === 'branches' ? 'Şube Yönetimi' : 'Kullanıcı Yönetimi'}</b><small>{new Date().toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</small></div><div className="topbar-actions"><span className="secure"><ShieldCheck size={15}/> Güvenli oturum</span><button className="icon-action" onClick={refresh} title="Yenile"><RefreshCw size={17}/></button></div></header>
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
              <button className="btn primary" disabled={busy}><Plus size={17}/> Şubeyi Kaydet</button>
            </form>
          </section>
          <section className="surface"><div className="section-head"><div><h2>Kayıtlı şubeler</h2><p>{branches.length} şube kayıtlı.</p></div></div>
            <div className="branch-list">
              {branches.map(branch => { const s = statusFor(branch); return <div className="branch-row branch-row-wrap" key={branch.id}><div className="branch-symbol"><MapPin size={18}/></div><div className="branch-main"><b>{branch.branch_name}</b><small>{branch.cities?.name} • {branch.branch_code}</small><span className={'status '+s.kind}>{s.icon}{s.label}</span></div><button className={'btn mini ' + (branch.is_enabled ? 'danger' : 'outline')} onClick={() => toggleBranch(branch)}>{branch.is_enabled ? 'Devre dışı bırak' : 'Etkinleştir'}</button></div>; })}
              {!branches.length && <div className="empty">Şube kaydı bulunmuyor.</div>}
            </div>
          </section>
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
    </main>
  </div>;
}

function Metric({ icon, label, value, note }: { icon: React.ReactNode; label: string; value: string; note: string }) {
  return <article className="metric-card"><div className="metric-top"><span>{label}</span><i>{icon}</i></div><strong>{value}</strong><small>{note}</small></article>;
}
