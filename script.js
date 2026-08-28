const PRICE = 10;
const TOTAL = 1000;
let WHATSAPP = '5573981602717';
let PIX = '73981602717';

const supabaseClient = window.supabase.createClient(window.RIFAPOP_SUPABASE_URL, window.RIFAPOP_SUPABASE_ANON_KEY);
const numbersEl = document.getElementById('numbers');
const countEl = document.getElementById('count');
const totalEl = document.getElementById('total');
const continueBtn = document.getElementById('continue');
const checkout = document.getElementById('checkout');
const chosenEl = document.getElementById('chosen');
const nameEl = document.getElementById('name');
const phoneEl = document.getElementById('phone');
const pixKeyEl = document.getElementById('pixKey');
const selected = new Set();
let statuses = new Map();

async function init(){
  if (!window.RIFAPOP_SUPABASE_URL || window.RIFAPOP_SUPABASE_URL.includes('COLE_AQUI')) {
    alert('Configure o Supabase no arquivo supabase-config.js antes de publicar.');
    return;
  }
  const { data: settings } = await supabaseClient.from('app_settings').select('pix,whatsapp,price,total_numbers').eq('id',true).single();
  if(settings){ PIX=settings.pix||PIX; WHATSAPP=(settings.whatsapp||WHATSAPP).replace(/\D/g,''); pixKeyEl.textContent=PIX; }
  await loadNumbers();
  supabaseClient.channel('rifapop-live').on('postgres_changes',{event:'*',schema:'public',table:'rifa_numbers'},()=>loadNumbers()).subscribe();
}
async function loadNumbers(){
  const {data,error}=await supabaseClient.from('rifa_numbers').select('number,status').order('number');
  if(error){console.error(error); return;}
  statuses=new Map(data.map(x=>[x.number,x.status]));
  renderNumbers();
}
function renderNumbers(){
  numbersEl.innerHTML='';
  for(let i=1;i<=TOTAL;i++){
    const b=document.createElement('button'); b.className='number'; b.textContent=String(i).padStart(3,'0'); b.setAttribute('aria-label',`Número ${i}`);
    const s=statuses.get(i)||'available';
    if(s!=='available'){b.classList.add('reserved');b.disabled=true;}
    else if(selected.has(i)) b.classList.add('selected');
    b.addEventListener('click',()=>toggle(i,b)); numbersEl.appendChild(b);
  }
  update();
}
function toggle(n,el){ if(selected.has(n)){selected.delete(n);el.classList.remove('selected')} else {selected.add(n);el.classList.add('selected')} update(); }
function update(){const count=selected.size;countEl.textContent=count;totalEl.textContent=`R$ ${(count*PRICE).toFixed(2).replace('.',',')}`;continueBtn.disabled=count===0;}
continueBtn.addEventListener('click',()=>{chosenEl.innerHTML=[...selected].sort((a,b)=>a-b).map(n=>`<span>${String(n).padStart(3,'0')}</span>`).join('');checkout.classList.remove('hidden');});
document.getElementById('closeCheckout').addEventListener('click',()=>checkout.classList.add('hidden'));
document.getElementById('copyPix').addEventListener('click',async()=>{await navigator.clipboard.writeText(pixKeyEl.textContent.trim());document.getElementById('copyPix').textContent='Copiado!';setTimeout(()=>document.getElementById('copyPix').textContent='Copiar',1500);});
document.getElementById('whatsapp').addEventListener('click',async()=>{
  const name=nameEl.value.trim(), phone=phoneEl.value.trim();
  if(!name||!phone)return alert('Preencha seu nome e WhatsApp.');
  const nums=[...selected].sort((a,b)=>a-b);
  if(!nums.length)return alert('Selecione pelo menos um número.');
  const btn=document.getElementById('whatsapp'); btn.disabled=true; btn.textContent='Reservando...';
  const {data,error}=await supabaseClient.rpc('reserve_numbers',{p_name:name,p_phone:phone,p_numbers:nums});
  if(error){alert('Não foi possível reservar agora. Tente novamente.');console.error(error);btn.disabled=false;btn.textContent='Enviar reserva pelo WhatsApp';return;}
  if(!data.ok){alert(`Alguns números já foram reservados: ${data.unavailable.map(n=>String(n).padStart(3,'0')).join(', ')}. Atualizamos a lista.`);await loadNumbers();btn.disabled=false;btn.textContent='Enviar reserva pelo WhatsApp';return;}
  const total=(nums.length*PRICE).toFixed(2).replace('.',',');
  const message=`Olá, RifaPop! Minha reserva foi registrada. Números: ${nums.map(n=>String(n).padStart(3,'0')).join(', ')}. Total: R$ ${total}. Nome: ${name}. WhatsApp: ${phone}. Vou enviar o comprovante do PIX.`;
  selected.clear(); await loadNumbers(); update(); checkout.classList.add('hidden');
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`,'_blank');
  btn.disabled=false; btn.textContent='Enviar reserva pelo WhatsApp';
});
init();
