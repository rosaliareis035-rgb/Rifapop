const PRICE = 10;
const TOTAL = 1000;
const RESERVATION_MINUTES = 30;
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

function addWinnerPanel(){
  if(document.getElementById('rifapop-winner-panel')) return;
  const style=document.createElement('style');
  style.textContent=`#rifapop-winner-panel{margin:28px auto 10px;max-width:900px;padding:2px 18px}.winner-box{background:linear-gradient(145deg,#171025,#0d0d14);border:1px solid #7c35ff;border-radius:24px;padding:28px 20px;text-align:center;box-shadow:0 0 35px rgba(124,53,255,.18)}.winner-label{display:inline-block;color:#d6b7ff;font-weight:800;font-size:13px;letter-spacing:1.5px;margin-bottom:10px}.winner-box h2{margin:5px 0 10px;font-size:30px;color:#fff}.winner-message{color:#c9c4d2;font-size:17px}.winner-number{display:inline-block;margin:16px 0;padding:12px 22px;border-radius:14px;background:#7c35ff;color:#fff;font-size:25px;font-weight:900}.winner-date{display:block;color:#9691a0;margin:5px 0 16px}.winner-share{border:0;border-radius:12px;padding:12px 18px;background:#fff;color:#16131d;font-weight:800;font-size:15px}.winner-hidden{display:none}`;
  document.head.appendChild(style);
  const panel=document.createElement('section'); panel.id='rifapop-winner-panel';
  panel.innerHTML=`<div class="winner-box"><span class="winner-label">🏆 RESULTADO DO SORTEIO</span><h2 id="winner-title">Resultado ainda não publicado</h2><div id="winner-message" class="winner-message">O resultado será divulgado aqui assim que o sorteio for realizado.</div><div id="winner-number" class="winner-number winner-hidden"></div><span id="winner-date" class="winner-date"></span><button id="winner-share" class="winner-share winner-hidden">📲 Compartilhar resultado</button></div>`;
  const main=document.querySelector('main'); const hero=document.querySelector('.hero');
  if(main&&hero) main.insertBefore(panel,hero.nextSibling); else if(main) main.prepend(panel);
  document.getElementById('winner-share').onclick=async()=>{const text=document.getElementById('winner-message').textContent+' '+document.getElementById('winner-number').textContent;if(navigator.share){try{await navigator.share({title:'Resultado RifaPop',text,url:location.href})}catch(e){}}else{await navigator.clipboard.writeText(location.href);alert('Link do resultado copiado!')}};
}

async function loadWinner(){
  try{const r=await fetch('winner.json?v='+Date.now(),{cache:'no-store'});const w=await r.json();if(!w.published)return;document.getElementById('winner-title').textContent='🎉 Temos um ganhador!';document.getElementById('winner-message').textContent=w.name?`Parabéns, ${w.name}!`:'Parabéns ao ganhador!';if(w.number){const n=document.getElementById('winner-number');n.textContent=`Número sorteado: ${w.number}`;n.classList.remove('winner-hidden')}if(w.date)document.getElementById('winner-date').textContent=`Sorteio realizado em ${w.date}`;document.getElementById('winner-share').classList.remove('winner-hidden')}catch(e){console.warn('Resultado ainda não disponível.',e)}
}

function addNumbersLegend(){
  if(document.getElementById('rifapop-numbers-legend')) return;
  const legend=document.createElement('div'); legend.id='rifapop-numbers-legend'; legend.className='legend';
  legend.innerHTML=`<span><i style="background:#151821"></i>Disponível</span><span><i style="background:#8b2cff"></i>Selecionado</span><span><i style="background:#363a45"></i>Já comprado / indisponível</span>`;
  const numbersSection=document.querySelector('.numbers-section'); const sectionHead=numbersSection?.querySelector('.section-head');
  if(sectionHead) sectionHead.appendChild(legend); else if(numbersSection) numbersSection.prepend(legend);
}

async function releaseExpiredReservations(){
  try{
    const {data,error}=await supabaseClient.rpc('release_expired_reservations');
    if(error) console.warn('Expiração automática ainda não configurada no Supabase.',error);
    if(data>0) await loadNumbers();
  }catch(e){console.warn('Não foi possível verificar reservas vencidas.',e)}
}

async function init(){
  addWinnerPanel(); loadWinner(); addNumbersLegend();
  if (!window.RIFAPOP_SUPABASE_URL || window.RIFAPOP_SUPABASE_URL.includes('COLE_AQUI')) { alert('Configure o Supabase no arquivo supabase-config.js antes de publicar.'); return; }
  const { data: settings } = await supabaseClient.from('app_settings').select('pix,whatsapp,price,total_numbers,reservation_minutes').eq('id',true).single();
  if(settings){ PIX=settings.pix||PIX; WHATSAPP=(settings.whatsapp||WHATSAPP).replace(/\D/g,''); pixKeyEl.textContent=PIX; }
  await releaseExpiredReservations();
  await loadNumbers();
  supabaseClient.channel('rifapop-live').on('postgres_changes',{event:'*',schema:'public',table:'rifa_numbers'},()=>loadNumbers()).subscribe();
  setInterval(async()=>{ await releaseExpiredReservations(); await loadNumbers(); },10000);
}

async function loadNumbers(){
  const {data,error}=await supabaseClient.from('rifa_numbers').select('number,status').order('number');
  if(error){console.error(error); return;}
  statuses=new Map(data.map(x=>[x.number,x.status])); renderNumbers();
}

function renderNumbers(){
  numbersEl.innerHTML='';
  for(let i=1;i<=TOTAL;i++){
    const b=document.createElement('button'); b.className='number'; b.textContent=String(i).padStart(3,'0'); b.setAttribute('aria-label',`Número ${i}`);
    const s=statuses.get(i)||'available';
    if(s!=='available'){b.classList.add('reserved');b.disabled=true;b.title=s==='reserved'?'Reservado — aguardando pagamento':'Número já pago ou indisponível';}
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
  const message=`Olá, RifaPop! Minha reserva foi registrada. Números: ${nums.map(n=>String(n).padStart(3,'0')).join(', ')}. Total: R$ ${total}. Nome: ${name}. WhatsApp: ${phone}. Você tem ${RESERVATION_MINUTES} minutos para enviar o comprovante do PIX; após esse prazo, a reserva será liberada automaticamente.`;
  selected.clear(); await loadNumbers(); update(); checkout.classList.add('hidden');
  window.open(`https://wa.me/${WHATSAPP}?text=${encodeURIComponent(message)}`,'_blank');
  btn.disabled=false; btn.textContent='Enviar reserva pelo WhatsApp';
});
init();
