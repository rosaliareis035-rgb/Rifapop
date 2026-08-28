const TOTAL=1000, PRICE=10;
const sb=window.supabase.createClient(window.RIFAPOP_SUPABASE_URL,window.RIFAPOP_SUPABASE_ANON_KEY);
const login=document.getElementById('login'),panel=document.getElementById('panel'),selected=new Set();
let state={numbers:new Map(),buyers:[],settings:{pix:'',wa:''}};

document.getElementById('loginBtn').onclick=loginAdmin;
document.getElementById('password').addEventListener('keydown',e=>{if(e.key==='Enter')loginAdmin()});
async function loginAdmin(){
  const email=document.getElementById('adminEmail').value.trim(), password=document.getElementById('password').value;
  if(!email||!password)return alert('Informe e-mail e senha.');
  const {error}=await sb.auth.signInWithPassword({email,password});
  if(error)return alert('Login inválido: '+error.message);
  login.classList.add('hidden');panel.classList.remove('hidden');await loadAll();
}
document.getElementById('logout').onclick=async()=>{await sb.auth.signOut();panel.classList.add('hidden');login.classList.remove('hidden');};
async function loadAll(){
  const [{data:numbers,error:nerr},{data:buyers,error:berr},{data:settings}]=await Promise.all([
    sb.from('rifa_numbers').select('*').order('number'),sb.from('buyers').select('*').order('created_at',{ascending:false}),sb.from('app_settings').select('*').eq('id',true).single()
  ]);
  if(nerr||berr)return alert('Erro ao carregar o painel.');
  state.numbers=new Map(numbers.map(x=>[x.number,x]));state.buyers=buyers||[];state.settings=settings||state.settings;render();loadSettings();
}
function render(){
 const filter=document.getElementById('filter').value,q=document.getElementById('search').value.toLowerCase();const el=document.getElementById('numbers');el.innerHTML='';let av=0,res=0,rev=0;
 for(let n=1;n<=TOTAL;n++){const d=state.numbers.get(n)||{status:'available'},s=d.status;if(s==='available')av++;else{res++;if(s==='paid')rev+=PRICE;}const hay=`${n} ${d.name||''} ${d.phone||''}`.toLowerCase();if((filter!=='all'&&s!==filter)||(q&&!hay.includes(q)))continue;const b=document.createElement('button');b.className=`num ${s}${selected.has(n)?' selected':''}`;b.innerHTML=`${String(n).padStart(3,'0')}<mark>${s==='available'?'livre':s==='paid'?'pago':'reservado'}</mark>`;b.onclick=()=>{selected.has(n)?selected.delete(n):selected.add(n);render()};el.appendChild(b)}
 document.getElementById('available').textContent=av;document.getElementById('reserved').textContent=res;document.getElementById('revenue').textContent=`R$ ${rev.toFixed(2).replace('.',',')}`;renderBuyers();
}
function renderBuyers(){const tb=document.getElementById('buyers');tb.innerHTML='';state.buyers.forEach(x=>{const tr=document.createElement('tr');tr.innerHTML=`<td>${x.numbers.join(', ')}</td><td>${escapeHtml(x.name)}</td><td>${escapeHtml(x.phone)}</td><td>R$ ${Number(x.total).toFixed(2).replace('.',',')}</td><td><span class="pill ${x.status}">${x.status==='paid'?'Pago':'Reservado'}</span></td><td><button class="secondary" data-id="${x.id}">${x.status==='paid'?'Marcar reserva':'Marcar pago'}</button></td>`;tr.querySelector('button').onclick=()=>togglePaid(x);tb.appendChild(tr)})}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]))}
async function togglePaid(x){const newStatus=x.status==='paid'?'reserved':'paid';const {error}=await sb.from('buyers').update({status:newStatus}).eq('id',x.id);if(error)return alert(error.message);await sb.from('rifa_numbers').update({status:newStatus}).eq('buyer_id',x.id);await loadAll();}
document.getElementById('reserveSelected').onclick=async()=>{if(!selected.size)return alert('Selecione números primeiro.');const name=prompt('Nome do comprador (opcional):')||'Reserva administrativa';const nums=[...selected];const {data,error}=await sb.rpc('reserve_numbers',{p_name:name,p_phone:'',p_numbers:nums});if(error)return alert(error.message);if(!data.ok)return alert('Algum número já está reservado.');selected.clear();await loadAll();};
document.getElementById('releaseSelected').onclick=async()=>{if(!selected.size)return;const nums=[...selected];const {error}=await sb.from('rifa_numbers').update({status:'available',buyer_id:null}).in('number',nums);if(error)return alert(error.message);selected.clear();await loadAll();};
document.getElementById('search').oninput=render;document.getElementById('filter').onchange=render;
function loadSettings(){document.getElementById('pix').value=state.settings.pix||'';document.getElementById('wa').value=state.settings.whatsapp||''}
document.getElementById('saveSettings').onclick=async()=>{const pix=document.getElementById('pix').value.trim(),wa=document.getElementById('wa').value.trim().replace(/\D/g,'');const {error}=await sb.from('app_settings').update({pix,whatsapp:wa,updated_at:new Date().toISOString()}).eq('id',true);if(error)return alert(error.message);state.settings.pix=pix;state.settings.whatsapp=wa;document.getElementById('saved').textContent='Configurações salvas.';setTimeout(()=>document.getElementById('saved').textContent='',1800)};
document.getElementById('export').onclick=()=>{const rows=[['Números','Nome','WhatsApp','Total','Status'],...state.buyers.map(x=>[x.numbers.join(' '),x.name,x.phone,Number(x.total).toFixed(2),x.status])];const csv=rows.map(r=>r.map(v=>`"${String(v).replaceAll('"','""')}"`).join(';')).join('\n');const a=document.createElement('a');a.href=URL.createObjectURL(new Blob(['\ufeff'+csv],{type:'text/csv'}));a.download='rifapop_compradores.csv';a.click()};
(async()=>{const {data:{session}}=await sb.auth.getSession();if(session){login.classList.add('hidden');panel.classList.remove('hidden');await loadAll();}})();
