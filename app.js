/* Sistema de Tickets PCP — regras de negócio RN01 a RN20 */
const DAY=864e5,CAP=40,SETUP_MESMA_FAMILIA=0.5;
const ET=["Pedido recebido","Análise técnica e engenharia","Aprovação do projeto","Separação de materiais","Preparação para produção","Programação da prensa de PU","Injeção de PU","Montagem da porta","Acessórios e componentes","Inspeção de qualidade","Expedição","Entrega ao cliente"];
const SE=["Comercial","Engenharia","Engenharia","Compras/Almoxarifado","PCP","PCP","Produção","Produção","Produção","Qualidade","Expedição","Expedição"];
const PX=["Registrar o pedido","Concluir a análise técnica e o desenho","Obter a aprovação do projeto","Separar e confirmar os materiais","Liberar kit e ordem de produção","Programar e ajustar a prensa","Injetar o PU e curar","Montar a porta","Instalar acessórios","Inspecionar e registrar o resultado","Embalar e carregar","Confirmar a entrega"];
const ST=["Aberto","Em análise","Aguardando material","Aguardando engenharia","Aguardando produção","Em produção","Aguardando qualidade","Bloqueado","Concluído"];
const SS=["Aberto","Em análise","Aguardando engenharia","Aguardando material","Aguardando produção","Aguardando produção","Em produção","Em produção","Em produção","Aguardando qualidade","Em produção","Em produção"];
const USERS=[{n:"Ana",s:"Comercial"},{n:"Marcos",s:"PCP"},{n:"Paulo",s:"Engenharia"},{n:"Luciana",s:"Compras/Almoxarifado"},{n:"Rafael",s:"Produção"},{n:"Camila",s:"Qualidade"},{n:"Diego",s:"Expedição"}];
const FAM=["Painel grande","Folha média","Folha pequena"],RK={Alta:0,Média:1,Baixa:2};
const R=[["RN01","Ticket individual com código único","Código PED-AAMM-nnn gerado automaticamente"],["RN02","Campos obrigatórios do ticket","Cliente, tipo, especificações, entrada (automática) e prazo"],["RN03","Sem cadastro incompleto","O formulário não envia com campo obrigatório vazio"],["RN04","Prioridade Alta, Média ou Baixa","Todo ticket tem prioridade; o novo entra como Média provisória"],["RN05","PCP define prioridade e sequência","Só o usuário PCP altera prioridade e ordem da fila"],["RN06","Sequência por prazo, criticidade e capacidade","Botão Sugerir sequência e ocupação da prensa (40 h, hipótese)"],["RN07","Agrupar pedidos semelhantes","Famílias de molde reduzem o setup; a economia é mostrada"],["RN08","Produção só com aprovação técnica e materiais","Não deixa avançar para a preparação sem as duas confirmações"],["RN09","Setor e responsável na próxima atividade","Atribuídos automaticamente a cada etapa"],["RN10","Cada setor atualiza sua etapa","Só o setor responsável conclui a etapa"],["RN11","Comunicação no histórico","Comentários e eventos ficam no ticket"],["RN12","Pendência com justificativa","O bloqueio exige motivo"],["RN13","Status Bloqueado","Aplicado ao bloquear o ticket"],["RN14","PCP notificado em bloqueio ou risco","Central de notificações; riscos de atraso são gerados sozinhos"],["RN15","Mudança de especificação registrada e comunicada","Grava antes/depois, notifica setores e exige nova aprovação técnica"],["RN16","Identificar prazos vencidos e próximos","Atrasado, vence em até 7 dias; avisos na visão geral"],["RN17","Prazo muda com justificativa e aprovação","Solicitação com justificativa; o PCP aprova ou rejeita"],["RN18","Inspeção antes da expedição","Qualidade registra aprovado/reprovado; reprovado volta à montagem"],["RN19","Concluído após qualidade e expedição","Exige inspeção aprovada e passagem pela expedição"],["RN20","Histórico com usuário, data e descrição","Todo evento grava usuário, setor, data/hora e texto"]];

const $=s=>document.querySelector(s);
const hoje=()=>{const d=new Date();d.setHours(0,0,0,0);return d};
const fmt=d=>d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0");
const iso=n=>{const d=hoje();d.setDate(d.getDate()+n);return fmt(d)};
const br=s=>s.split("-").reverse().join("/");
const dt=s=>new Date(s).toLocaleString("pt-BR",{dateStyle:"short",timeStyle:"short"});
const dl=t=>Math.round((new Date(t.prazo+"T00:00:00")-hoje())/DAY);
const tg=(c,x)=>`<span class="tag ${c}">${x}</span>`;
let S,tab="painel";
const T=()=>S.t,me=()=>USERS[S.u],isP=()=>me().s==="PCP",find=id=>T().find(t=>t.id===id);
const done=t=>t.st==="Concluído",late=t=>!done(t)&&dl(t)<0,near=t=>!done(t)&&dl(t)>=0&&dl(t)<=7;
const def=s=>USERS.find(u=>u.s===s).n;
const sv=()=>{try{localStorage.setItem("tk27",JSON.stringify(S))}catch(e){}};
function toast(m,bad=1){const e=$("#tt");e.textContent=m;e.className="tt on "+(bad?"bad":"ok");clearTimeout(toast.x);toast.x=setTimeout(()=>e.className="tt",4000)}
const fechar=()=>$("#ov").classList.remove("on");
const log=(t,x)=>t.h.push({d:new Date().toISOString(),u:me().n,s:me().s,t:x});
const notify=(t,m)=>S.n.unshift({k:t.id+Date.now()+Math.random(),id:t.id,m,d:new Date().toISOString(),r:false});

/* ---------- dados iniciais (datas relativas a hoje) ---------- */
const L=(o,u,s,t)=>({d:iso(o)+"T09:00:00",u,s,t});
function seed(){
  const p="PED-"+iso(0).slice(2,4)+iso(0).slice(5,7)+"-",b={ap:false,mat:false,qa:"",pend:null,ret:0,ord:99,obs:"Sem pendências"};
  return [
  {...b,id:p+"001",cli:"Frigorífico Serra Alta (fict.)",crit:"Alta",tipo:"Porta de correr — congelados",esp:"Painel PU 150 mm, −25 °C, trilho inox, batente aquecido",dim:"3000 × 3200 mm",ent:iso(-7),prazo:iso(11),prio:"Alta",just:"Cliente de grande porte com auditoria; multa por atraso",et:5,set:"PCP",resp:"Marcos",st:"Aguardando produção",su:1.5,inj:3.5,fam:FAM[0],ap:true,mat:true,h:[L(-7,"Ana","Comercial","Pedido registrado."),L(-3,"Paulo","Engenharia","Projeto aprovado."),L(-1,"Luciana","Compras/Almoxarifado","Materiais confirmados.")]},
  {...b,id:p+"002",cli:"Laticínios Vale Verde (fict.)",crit:"Média",tipo:"Porta giratória — resfriados",esp:"Folha PU 80 mm, 0 a 4 °C, motor e eixo central",dim:"1800 × 2400 mm",ent:iso(-8),prazo:iso(18),prio:"Média",just:"Prazo confortável, mas motor com lead time incerto",et:3,set:"Compras/Almoxarifado",resp:"Luciana",st:"Aguardando material",su:1,inj:2,fam:FAM[1],ap:true,obs:"Aguardando motor e rolamentos",h:[L(-8,"Ana","Comercial","Pedido registrado."),L(-4,"Paulo","Engenharia","Projeto aprovado.")]},
  {...b,id:p+"003",cli:"Supermercados Mercadão (fict.)",crit:"Baixa",tipo:"Porta frigorífica de abrir",esp:"Folha PU 60 mm, resfriados, fechadura com trava interna",dim:"1200 × 2100 mm",ent:iso(-6),prazo:iso(26),prio:"Baixa",just:"Reforma sem data crítica",et:1,set:"Engenharia",resp:"Paulo",st:"Em análise",su:.5,inj:1,fam:FAM[1],obs:"Falta confirmar o lado de abertura",h:[L(-6,"Ana","Comercial","Pedido registrado.")]},
  {...b,id:p+"004",cli:"Pampa Export Carnes (fict.)",crit:"Alta",tipo:"Porta industrial personalizada",esp:"Vertical de alta velocidade, painel PU 100 mm, cortina de ar",dim:"2800 × 3500 mm",ent:iso(-5),prazo:iso(7),prio:"Alta",just:"Auditoria de exportação logo após a entrega",et:1,set:"Engenharia",resp:"Paulo",st:"Bloqueado",su:2,inj:4,fam:FAM[0],obs:"Vão no desenho (3500) difere da medição em obra (3350 mm)",h:[L(-5,"Ana","Comercial","Pedido urgente registrado."),L(-1,"Paulo","Engenharia","BLOQUEADO: divergência de dimensão do vão.")]},
  {...b,id:p+"005",cli:"Biofrio Alimentos (fict.)",crit:"Média",tipo:"Porta frigorífica com visor e rodapé aquecido",esp:"Folha PU 120 mm, −30 °C, visor triplo, resistência antigelo",dim:"1400 × 2200 mm",ent:iso(-12),prazo:iso(4),prio:"Média",just:"Prazo próximo, mas a injeção já foi concluída",et:7,set:"Produção",resp:"Rafael",st:"Em produção",su:1,inj:2.5,fam:FAM[1],ap:true,mat:true,obs:"Visor chega amanhã",h:[L(-12,"Ana","Comercial","Pedido registrado."),L(-5,"Rafael","Produção","Injeção de PU concluída."),L(0,"Rafael","Produção","Montagem iniciada.")]}];
}
function init(){
  try{S=JSON.parse(localStorage.getItem("tk27"))}catch(e){}
  if(!S){const t=seed();S={t,n:[],u:1};sugerir();const x=t[3];S.n.push({k:"seed4",id:x.id,m:"Bloqueio: divergência de dimensão do vão (3500 × 3350 mm).",d:new Date().toISOString(),r:false});sv()}
  $("#ov").addEventListener("click",e=>{if(e.target.id==="ov")fechar()});
  $("#bell").onclick=()=>{tab="notif";render()};
  $("#avb").onclick=e=>{e.stopPropagation();$("#menu").classList.toggle("on")};
  document.addEventListener("click",()=>$("#menu").classList.remove("on"));
  $("#gs").addEventListener("input",e=>buscar(e.target.value));
  $("#lf").onsubmit=e=>{e.preventDefault();entrar()};
  render();
}
function reset(){if(confirm("Restaurar os dados de exemplo? Suas alterações serão perdidas.")){try{localStorage.removeItem("tk27")}catch(e){}location.reload()}}

/* ---------- sequência da prensa (RN05, RN06, RN07) ---------- */
const fila=()=>T().filter(t=>!done(t)&&t.et<=6).sort((a,b)=>a.ord-b.ord);
function ordenar(l){const o=[];["Alta","Média","Baixa"].forEach(p=>{const g=l.filter(t=>t.prio===p).sort((a,b)=>RK[a.crit]-RK[b.crit]||a.prazo.localeCompare(b.prazo));[...new Set(g.map(t=>t.fam))].forEach(f=>g.filter(t=>t.fam===f).forEach(t=>o.push(t)))});return o}
function sugerir(){ordenar(T().filter(t=>!done(t)&&t.et<=6)).forEach((t,i)=>t.ord=i+1)}
const setup=l=>l.reduce((s,t,i)=>s+(i&&l[i-1].fam===t.fam?SETUP_MESMA_FAMILIA:t.su),0);
function calc(f){const su=setup(f),h=su+f.reduce((s,t)=>s+t.inj,0),fifo=setup(f.slice().sort((a,b)=>a.ent.localeCompare(b.ent)));return{su,h,fifo,pct:Math.round(h/CAP*100)}}
function sugerirClick(){if(!isP())return toast("RN05: apenas o PCP define a sequência.");sugerir();log0("Sequência da prensa recalculada (prioridade, criticidade, prazo e família).");sv();render();toast("Sequência sugerida aplicada.",0)}
function log0(x){const t=fila()[0]||T()[0];if(t)log(t,x)}
function mover(id,d){if(!isP())return toast("RN05: apenas o PCP define a sequência.");const f=fila(),i=f.findIndex(t=>t.id===id),j=i+d;if(j<0||j>=f.length)return;f.forEach((t,k)=>t.ord=k+1);[f[i].ord,f[j].ord]=[f[j].ord,f[i].ord];log(f[i],"Posição na fila da prensa alterada manualmente pelo PCP.");sv();render()}
function acao(t,prev){if(t.st==="Bloqueado")return"Resolver o bloqueio e reservar a prensa";if(!(t.ap&&t.mat))return"Liberar aprovação técnica e materiais (RN08)";if(prev&&prev.fam===t.fam)return"Encaixar após "+prev.id+" sem trocar o molde";return"Programar a prensa"}

/* ---------- notificações (RN14, RN16) ---------- */
function riscos(){let c=0;T().filter(t=>late(t)||near(t)).forEach(t=>{const k=t.id+(late(t)?"L":"N");if(!S.n.some(n=>n.k===k)){S.n.unshift({k,id:t.id,m:late(t)?"Pedido atrasado há "+(-dl(t))+" dia(s)":"Risco de atraso: vence em "+dl(t)+" dia(s)",d:new Date().toISOString(),r:false});c=1}});if(c)sv()}

/* ---------- telas ---------- */
const tabs={painel:"Visão geral",kanban:"Quadro Kanban",lista:"Todos os tickets",seq:"Sequência da prensa",notif:"Notificações",rn:"Regras de negócio"};
const IC={home:"M3 11l9-8 9 8M5 10v10h14V10",kan:"M4 4h6v16H4zM14 4h6v9h-6z",list:"M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01",clock:"M12 7v5l3 2M21 12a9 9 0 11-18 0 9 9 0 0118 0",bell:"M6 8a6 6 0 1112 0c0 7 3 9 3 9H3s3-2 3-9M10 21h4",book:"M4 19V5a2 2 0 012-2h13v16H6a2 2 0 00-2 2M4 19a2 2 0 002 2h13",plus:"M12 5v14M5 12h14",alert:"M12 9v4M12 17h.01M10.3 3.9L2 18a2 2 0 001.7 3h16.6a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",check:"M20 6L9 17l-5-5",out:"M9 21H5V3h4M16 17l5-5-5-5M21 12H9",doc:"M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8zM14 3v5h5",box:"M21 8l-9-5-9 5v8l9 5 9-5zM3 8l9 5 9-5M12 13v8"};
const ic=(n,s=18)=>`<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${IC[n]}"/></svg>`;
const ini=n=>n.slice(0,2).toUpperCase();
const NAV=[["painel","home"],["kanban","kan"],["lista","list"],["seq","clock"],["notif","bell"],["rn","book"]];
const SUB={painel:"Acompanhe pedidos, prazos e pendências de toda a produção.",kanban:"Arraste os cards entre os status (respeitando as regras) ou clique para abrir o ticket.",lista:"Todos os pedidos de fabricação, um ticket por pedido.",seq:"Ordem de injeção da prensa de PU, o principal gargalo.",notif:"Avisos para o PCP: bloqueios, riscos de atraso e mudanças.",rn:"As 20 regras de negócio e como o sistema as aplica."};
function render(){
  $("#login").style.display=S.in?"none":"flex";$("#app").style.display=S.in?"flex":"none";
  if(!S.in){$("#lu").innerHTML=USERS.map((u,i)=>`<option value="${i}" ${i===S.u?"selected":""}>${u.n} — ${u.s}</option>`).join("");return}
  riscos();const un=S.n.filter(n=>!n.r).length,u=me();
  const bd={lista:T().filter(t=>!done(t)).length,notif:un,seq:fila().length,kanban:T().filter(t=>t.st==="Bloqueado").length};
  $("#side").innerHTML=`<div class="brand"><div class="logo">${ic("box",20)}</div><div><b>PortaFlow</b><small>GESTÃO PCP</small></div></div><div class="env"><span>AMBIENTE</span><b>Frigoporta Indústria (fict.)</b></div><div class="grp">OPERAÇÃO</div>${NAV.map(([k,i])=>`<button class="ni ${k===tab?"on":""}" onclick="tab='${k}';render()">${ic(i)}<span>${tabs[k]}</span>${bd[k]?`<em>${bd[k]}</em>`:""}</button>`).join("")}<div class="sp"></div><div class="me" onclick="logout()"><div class="av">${ini(u.n)}</div><div><b>${u.n}</b><small>${u.s}</small></div>${ic("out",16)}</div>`;
  $("#bell").innerHTML=ic("bell",18)+(un?`<i>${un}</i>`:"");
  $("#avb").innerHTML=`<span class="av">${ini(u.n)}</span>`;
  $("#menu").innerHTML=`<small style="padding:6px 8px">Trocar usuário (demonstração)</small>`+USERS.map((x,i)=>`<button onclick="trocar(${i})" class="${i===S.u?"on":""}">${x.n} · ${x.s}</button>`).join("")+`<hr><button onclick="reset()">Restaurar dados de exemplo</button><button onclick="logout()">Sair</button>`;
  const d=new Date().toLocaleDateString("pt-BR",{weekday:"long",day:"numeric",month:"long"}).toUpperCase();
  $("#m").innerHTML=`<div class="ph"><div><small class="dt">${d}</small><h1>${tabs[tab]}</h1><p>${SUB[tab]}</p></div><button class="cta" onclick="novo()">${ic("plus",16)} Novo ticket</button></div>`+{painel,kanban,lista,seq,notif,rn}[tab]()}
function entrar(){if($("#lp").value!=="demo123"){$("#le").textContent="Senha incorreta. Use a senha de exemplo: demo123";return}S.u=+$("#lu").value;S.in=true;$("#le").textContent="";tab="painel";sv();render()}
function logout(){S.in=false;sv();fechar();render()}
function trocar(i){S.u=i;sv();fechar();render()}
function buscar(v){if(tab!=="lista"){tab="lista";render()}filtrar(v)}
function pill(t,x){const c={"Bloqueado":"r","Concluído":"g","Em produção":"g","Aguardando material":"y","Aguardando engenharia":"y","Aguardando produção":"y","Aguardando qualidade":"p"}[t.st]||"b";return `<span class="pl ${c}">${x||t.st}</span>`}
function pz(t){if(done(t))return br(t.prazo);const d=dl(t);return d<0?`<b class="red">Atrasado ${-d}d</b>`:d===0?`<b class="red">Hoje</b>`:d<=7?`<b class="red">Em ${d} dias</b>`:br(t.prazo).slice(0,5)}
const kc=(i,c,l,v,s)=>`<div class="kc"><div class="ki ${c}">${ic(i,20)}</div><div><small>${l}</small><b>${v}</b><em>${s}</em></div></div>`;
function painel(){const a=T().filter(t=>!done(t)),f=fila(),r=calc(f),n=fn=>T().filter(fn).length;
  const al=T().filter(t=>t.st==="Bloqueado"||late(t)||near(t)),by=(x,y)=>x.prazo.localeCompare(y.prazo);
  const dest=a.slice().sort((x,y)=>RK[x.prio]-RK[y.prio]||by(x,y))[0];
  const rows=a.slice().sort(by).slice(0,6).map(t=>`<tr class="cl" onclick="open_('${t.id}')"><td><b>${t.id}</b><small>${t.tipo}</small></td><td>${pill(t,ET[t.et])}</td><td><span class="av s">${ini(t.resp)}</span>${t.resp}</td><td>${pz(t)}</td></tr>`).join("");
  const at=al.slice(0,5).map(t=>{const b=t.st==="Bloqueado";return `<div class="ai" onclick="open_('${t.id}')"><div class="ki ${b?"r":"y"}">${ic(b?"alert":"clock",16)}</div><div><b>${b?"Bloqueado: "+t.obs:late(t)?"Pedido atrasado":"Prazo próximo"}</b><small>${t.id} · ${t.cli}</small><small>${b?"Setor "+t.set:"Vence em "+br(t.prazo)}</small></div></div>`}).join("")||`<p class="mu pad">Nenhuma pendência no momento.</p>`;
  const st=dest?ET.map((e,i)=>`<div class="sp1 ${i<dest.et?"d":i===dest.et?"c":""}"><div class="dot">${i<dest.et?ic("check",14):i+1}</div><b>${e}</b><small>${SE[i]}</small></div>`).join(""):"";
  return `<div class="kg">${kc("doc","b","Pedidos abertos",a.length,n(done)+" concluídos")}${kc("box","g","Em produção",n(t=>t.st==="Em produção"),n(near)+" vencem em 7 dias")}${kc("alert","r","Bloqueados",n(t=>t.st==="Bloqueado"),n(late)+" atrasados")}${kc("clock","y","Prensa de PU",r.pct+"%",r.h.toFixed(1)+" h de "+CAP+" h · setup "+r.su.toFixed(1)+" h")}</div>
  <div class="r2"><div class="cd"><div class="ch"><div><b>Pedidos em andamento</b><small>Ordenados pelo prazo de entrega</small></div><a href="#" onclick="tab='lista';render();return false">Ver todos ›</a></div><div class="wrap"><table><tr><th>Pedido</th><th>Etapa atual</th><th>Responsável</th><th>Prazo</th></tr>${rows}</table></div></div>
  <div class="cd"><div class="ch"><div><b>Requer atenção</b><small>Pendências que bloqueiam o fluxo</small></div><span class="cnt">${al.length}</span></div>${at}</div></div>
  ${dest?`<div class="cd"><div class="ch"><div><b>Fluxo do pedido em destaque</b><small>${dest.id} · ${dest.cli} · ${dest.tipo}</small></div><button class="b" onclick="open_('${dest.id}')">Abrir ticket</button></div><div class="stp">${st}</div></div>`:""}`}
function dprazo(t){return late(t)?tg("red","Atrasado"):near(t)?tg("red","Vence em "+dl(t)+"d"):tg("","Prazo "+br(t.prazo))}
function card(t){return `<div class="card ${t.prio}" draggable="true" ondragstart="event.dataTransfer.setData('t','${t.id}')" onclick="open_('${t.id}')"><b>${t.id}</b>${t.tipo}<br><small>${t.cli}</small><div class="pg"><i style="width:${Math.round((t.et+1)/12*100)}%"></i></div>${tg(t.prio,t.prio)}${dprazo(t)}</div>`}
function kanban(){return `<div class="kan">${ST.map(s=>{const l=T().filter(t=>t.st===s);return `<div class="col" ondragover="event.preventDefault()" ondrop="soltar(event,'${s}')"><h4>${s}<span>${l.length}</span></h4>${l.map(card).join("")}</div>`}).join("")}</div>`}
function soltar(e,s){const t=find(e.dataTransfer.getData("t"));if(!t||t.st===s)return;
  if(s==="Bloqueado")return open_(t.id),toast("Informe o motivo do bloqueio (RN12).");
  if(s==="Concluído")return toast("RN19: só conclui após inspeção aprovada e expedição. Use o ticket.");
  if(!(isP()||me().s===t.set))return toast("RN10: só o setor responsável ("+t.set+") ou o PCP altera o status.");
  if(["Aguardando produção","Em produção","Aguardando qualidade"].includes(s)&&!(t.ap&&t.mat))return toast("RN08: falta aprovação técnica e/ou confirmação de materiais.");
  log(t,"Status alterado de "+t.st+" para "+s+".");t.st=s;sv();render()}
function lista(){return `<div class="cd wrap"><table><tr><th>Pedido</th><th>Cliente</th><th>Etapa atual</th><th>Responsável</th><th>Prioridade</th><th>Prazo</th><th>Status</th></tr>${T().map(t=>`<tr class="cl" onclick="open_('${t.id}')"><td><b>${t.id}</b><small>${t.tipo}</small></td><td>${t.cli}</td><td>${t.et+1}. ${ET[t.et]}</td><td><span class="av s">${ini(t.resp)}</span>${t.resp}</td><td>${tg(t.prio,t.prio)}</td><td>${pz(t)}</td><td>${pill(t)}</td></tr>`).join("")}</table></div>`}
function filtrar(v){v=v.toLowerCase();document.querySelectorAll("#m tr.cl").forEach(r=>r.style.display=r.textContent.toLowerCase().includes(v)?"":"none")}
function seq(){const f=fila(),r=calc(f);
  return `<div class="box"><h3>Fila da prensa de PU</h3><p class="mu">Ordem: prioridade, criticidade do cliente e prazo; pedidos da mesma família de molde ficam juntos (setup de ${SETUP_MESMA_FAMILIA} h em vez do setup completo). Só o PCP altera a sequência.</p>
  <div class="bar ${r.pct>100?"over":""}"><i style="width:${Math.min(100,r.pct)}%"></i></div>
  <p>${r.h.toFixed(1)} h de ${CAP} h (${r.pct}%) · setup com agrupamento: <b>${r.su.toFixed(1)} h</b> · por ordem de entrada: ${r.fifo.toFixed(1)} h · economia: <b>${(r.fifo-r.su).toFixed(1)} h</b>${r.pct>100?" · <b style='color:var(--al)'>capacidade excedida</b>":""}</p>
  <button class="b p" onclick="sugerirClick()">Sugerir sequência</button></div>
  <div class="box wrap"><table><tr><th>#</th><th>Pedido</th><th>Tipo de porta</th><th>Família</th><th>Prazo</th><th>Prioridade</th><th>Setup + injeção</th><th>Ação recomendada</th><th></th></tr>${f.map((t,i)=>`<tr><td>${i+1}</td><td><a href="#" onclick="open_('${t.id}');return false">${t.id}</a></td><td>${t.tipo}</td><td>${t.fam}</td><td>${br(t.prazo)}</td><td>${tg(t.prio,t.prio)}</td><td>${(i&&f[i-1].fam===t.fam?SETUP_MESMA_FAMILIA:t.su)} h + ${t.inj} h</td><td>${acao(t,f[i-1])}</td><td><button class="b" onclick="mover('${t.id}',-1)">↑</button> <button class="b" onclick="mover('${t.id}',1)">↓</button></td></tr>`).join("")||"<tr><td colspan=9>Fila vazia</td></tr>"}</table></div>`}
function notif(){return `<div class="row" style="margin:0 0 10px"><p class="mu" style="flex:1">Avisos destinados ao PCP: bloqueios, alterações de especificação, reprovações e riscos de atraso (RN14).</p><button class="b" onclick="S.n.forEach(n=>n.r=true);sv();render()">Marcar todas como lidas</button></div><div class="box wrap"><table><tr><th>Quando</th><th>Pedido</th><th>Aviso</th></tr>${S.n.map(n=>`<tr class="cl ${n.r?"":"un"}" onclick="lerN('${n.k}','${n.id}')"><td>${dt(n.d)}</td><td>${n.id}</td><td>${n.m}</td></tr>`).join("")||"<tr><td colspan=3>Sem notificações</td></tr>"}</table></div>`}
function lerN(k,id){const n=S.n.find(x=>x.k===k);if(n)n.r=true;sv();open_(id);render()}
function rn(){return `<div class="box wrap"><h3>Regras de negócio e como o sistema as aplica</h3><table><tr><th>Código</th><th>Regra</th><th>No sistema</th></tr>${R.map(r=>`<tr><td>${r[0]}</td><td>${r[1]}</td><td>${r[2]}</td></tr>`).join("")}</table></div>
  <p class="hint">Dica: para testar as permissões, troque o usuário no topo (por exemplo, só o PCP muda prioridade e só a Qualidade registra inspeção).</p>`}

/* ---------- ticket ---------- */
function open_(id){const t=find(id);if(!t)return;
  $("#mod").innerHTML=`<div class="top"><div><h2>${t.id}</h2>${tg(t.prio,"Prioridade "+t.prio)}${tg("",t.st)}${dprazo(t)}</div><button class="b" onclick="fechar()">Fechar</button></div>
  <div class="pg big"><i style="width:${Math.round((t.et+1)/12*100)}%"></i></div><small class="mu">Etapa ${t.et+1} de 12 — ${ET[t.et]}</small>
  <div class="hl"><b>Próxima atividade:</b> ${PX[t.et]}<br><small>Responsável: ${t.resp} · Setor: ${t.set}</small></div>
  <div class="g"><div><span>Cliente (criticidade ${t.crit})</span>${t.cli}</div><div><span>Tipo de porta</span>${t.tipo}</div><div><span>Entrada / Prazo</span>${br(t.ent)} / ${br(t.prazo)} (${dl(t)}d)</div><div><span>Família de molde · setup + injeção</span>${t.fam} · ${t.su} h + ${t.inj} h</div><div><span>Justificativa da prioridade</span>${t.just}</div><div><span>Observações e pendências</span>${t.obs}</div></div>
  <p class="mu">Você está como <b>${me().n} (${me().s})</b>. Para agir em outra etapa, troque o usuário no topo.</p>
  <div class="row">${done(t)?tg("Baixa","Pedido concluído"):`<button class="b p" onclick="avancar('${t.id}')">${t.et===11?"Finalizar entrega e concluir pedido":"Concluir etapa → "+ET[t.et+1]}</button>`}</div>
  <h3>Liberação para produção (RN08) e qualidade (RN18)</h3>
  <div class="row"><label><input type="checkbox" ${t.ap?"checked":""} onchange="setF('${t.id}','ap',this.checked)"> Aprovação técnica (Engenharia)</label><label><input type="checkbox" ${t.mat?"checked":""} onchange="setF('${t.id}','mat',this.checked)"> Materiais confirmados (Compras)</label><span class="mu">Inspeção: <b>${t.qa||"pendente"}</b> · retrabalhos: ${t.ret}</span></div>
  ${t.et===9?`<div class="row"><select id="qs"><option>Aprovado<option>Reprovado</select><input id="qo" placeholder="Observação da inspeção"><button class="b" onclick="inspecao('${t.id}')">Registrar inspeção</button></div>`:""}
  <h3>Bloqueio (RN12, RN13)</h3>
  <div class="row"><input id="mt" placeholder="${t.st==="Bloqueado"?"Solução / observação":"Motivo do bloqueio (obrigatório)"}">${t.st==="Bloqueado"?`<button class="b" onclick="desbloq('${t.id}')">Desbloquear</button>`:`<button class="b d" onclick="bloq('${t.id}')" ${done(t)?"disabled":""}>Bloquear</button>`}</div>
  <h3>Prioridade (RN05) e prazo (RN17)</h3>
  <div class="row"><select id="pp">${["Alta","Média","Baixa"].map(p=>`<option ${p===t.prio?"selected":""}>${p}`).join("")}</select><input id="pj" placeholder="Justificativa da prioridade"><button class="b" onclick="setPrio('${t.id}')">Salvar prioridade (PCP)</button></div>
  ${t.pend?`<div class="hl">Solicitação de prazo de ${t.pend.por}: <b>${br(t.pend.novo)}</b> — ${t.pend.j}<div class="row"><button class="b p" onclick="decPrazo('${t.id}',1)">Aprovar (PCP)</button><button class="b d" onclick="decPrazo('${t.id}',0)">Rejeitar (PCP)</button></div></div>`:`<div class="row"><input id="np" type="date"><input id="nj" placeholder="Justificativa da mudança de prazo"><button class="b" onclick="pedPrazo('${t.id}')">Solicitar novo prazo</button></div>`}
  <h3>Especificações técnicas (RN15)</h3>
  <div class="row"><textarea id="ee" rows="2">${t.esp}</textarea><input id="ed" value="${t.dim}"><button class="b" onclick="salvarEsp('${t.id}')">Salvar alteração</button></div>
  <h3>Histórico e comunicação (RN11, RN20)</h3>
  <div class="row"><textarea id="ct" rows="2" placeholder="Registrar atualização ou mensagem para os setores"></textarea><button class="b p" onclick="coment('${t.id}')">Enviar</button></div>
  <div class="hist">${t.h.slice().reverse().map(h=>`<p><small>${dt(h.d)} · ${h.u} (${h.s})</small><br>${h.t}</p>`).join("")}</div>`;
  $("#ov").classList.add("on")}
const val=i=>$("#"+i).value.trim(),redo=id=>{sv();open_(id);render()};
function avancar(id){const t=find(id);
  if(t.st==="Bloqueado")return toast("Ticket bloqueado: desbloqueie antes de avançar (RN13).");
  if(me().s!==t.set)return toast("RN10: só o setor responsável ("+t.set+") conclui esta etapa.");
  if(t.et+1>=4&&t.et<4&&!(t.ap&&t.mat))return toast("RN08: a produção só inicia com aprovação técnica e confirmação de materiais.");
  if(t.et===9&&t.qa!=="Aprovado")return toast("RN18: registre a inspeção aprovada antes de liberar para expedição.");
  if(t.et===11){if(t.qa!=="Aprovado")return toast("RN19: falta a aprovação da qualidade.");t.st="Concluído";t.obs="Pedido entregue";log(t,"Entrega confirmada. Pedido concluído (qualidade aprovada e expedição finalizada).");return redo(id)}
  log(t,"Etapa concluída: "+ET[t.et]+".");t.et++;t.set=SE[t.et];t.resp=def(t.set);t.st=SS[t.et];
  log(t,"Ticket encaminhado a "+t.set+" ("+t.resp+") — etapa: "+ET[t.et]+".");redo(id)}
function setF(id,f,v){const t=find(id),ro={ap:"Engenharia",mat:"Compras/Almoxarifado"}[f];
  if(me().s!==ro){toast("Apenas "+ro+" altera este item.");return open_(id)}
  t[f]=v;log(t,(f==="ap"?"Aprovação técnica ":"Materiais ")+(v?"confirmada(os).":"retirada(os)."));redo(id)}
function inspecao(id){const t=find(id),r=val("qs"),o=val("qo");
  if(me().s!=="Qualidade")return toast("Apenas a Qualidade registra a inspeção (RN18).");
  if(r==="Reprovado"&&!o)return toast("Informe o motivo da reprovação.");
  t.qa=r;log(t,"Inspeção de qualidade: "+r+(o?" — "+o:"")+".");
  if(r==="Reprovado"){t.ret++;t.et=7;t.set=SE[7];t.resp=def(t.set);t.st="Em produção";t.qa="Reprovado";t.obs="Retrabalho: "+o;log(t,"Retrabalho: ticket devolvido a Produção (montagem).");notify(t,"Reprovado na inspeção: "+o)}
  redo(id)}
function bloq(id){const t=find(id),m=val("mt");if(!m)return toast("RN12: informe o motivo do bloqueio.");
  t.st="Bloqueado";t.obs=m;log(t,"BLOQUEADO: "+m);notify(t,"Bloqueio: "+m);redo(id);toast("Ticket bloqueado e PCP notificado.",0)}
function desbloq(id){const t=find(id);if(!(isP()||me().s===t.set))return toast("Apenas o PCP ou o setor responsável desbloqueia.");
  const m=val("mt");t.st=SS[t.et];t.obs="Sem pendências";log(t,"Desbloqueado"+(m?": "+m:".")+" Retomado em: "+ET[t.et]+".");redo(id)}
function setPrio(id){const t=find(id),p=val("pp"),j=val("pj");
  if(!isP())return toast("RN05: apenas o PCP define a prioridade.");
  if(!j)return toast("Informe a justificativa da prioridade.");
  log(t,"Prioridade alterada de "+t.prio+" para "+p+". Justificativa: "+j);t.prio=p;t.just=j;redo(id)}
function pedPrazo(id){const t=find(id),n=val("np"),j=val("nj");
  if(!n||!j)return toast("RN17: informe a nova data e a justificativa.");
  t.pend={novo:n,j,por:me().n};log(t,"Solicitada mudança de prazo para "+br(n)+". Justificativa: "+j);notify(t,"Solicitação de novo prazo ("+br(n)+"): "+j);redo(id)}
function decPrazo(id,ok){const t=find(id);if(!isP())return toast("RN17: apenas o PCP aprova mudança de prazo.");
  if(ok){log(t,"Prazo alterado de "+br(t.prazo)+" para "+br(t.pend.novo)+", aprovado por "+me().n+". Justificativa: "+t.pend.j);t.prazo=t.pend.novo}
  else log(t,"Solicitação de prazo rejeitada por "+me().n+".");
  t.pend=null;redo(id)}
function salvarEsp(id){const t=find(id),e=val("ee"),d=val("ed");
  if(!["Engenharia","Comercial","PCP"].includes(me().s))return toast("Apenas Engenharia, Comercial ou PCP alteram especificações.");
  if(!e)return toast("A especificação não pode ficar vazia.");
  if(e===t.esp&&d===t.dim)return toast("Nada foi alterado.");
  log(t,"Especificações alteradas. Antes: "+t.esp+" ("+t.dim+"). Depois: "+e+" ("+d+"). Setores comunicados: Engenharia, PCP, Produção, Qualidade.");
  notify(t,"Especificação alterada; setores envolvidos comunicados.");t.esp=e;t.dim=d;
  if(t.et<=4&&t.ap){t.ap=false;log(t,"Nova aprovação técnica necessária após a alteração.")}redo(id)}
function coment(id){const t=find(id),v=val("ct");if(!v)return;log(t,v);redo(id)}
function novo(){if(!["Comercial","PCP"].includes(me().s))return toast("Apenas Comercial ou PCP cadastram pedidos.");
  $("#mod").innerHTML=`<h2>Novo ticket</h2><p class="mu">Campos com * são obrigatórios (RN03). A prioridade entra como Média e o PCP a define depois.</p>
  <div class="fm"><label>Cliente *<input id="nc"></label><label>Tipo de porta *<input id="nt"></label><label class="w">Especificações técnicas *<textarea id="ne" rows="2"></textarea></label><label>Dimensões<input id="nd"></label><label>Prazo de entrega *<input id="np" type="date"></label><label>Criticidade do cliente<select id="nk"><option>Alta<option selected>Média<option>Baixa</select></label><label>Família de molde<select id="nf">${FAM.map(f=>`<option>${f}`).join("")}</select></label></div>
  <div class="row"><button class="b p" onclick="criar()">Criar ticket</button><button class="b" onclick="fechar()">Cancelar</button></div>`;
  $("#ov").classList.add("on")}
function criar(){let ok=true;["nc","nt","ne","np"].forEach(i=>{const e=$("#"+i),v=!e.value.trim();e.classList.toggle("err",v);if(v)ok=false});
  if(!ok)return toast("RN03: preencha todos os campos obrigatórios.");
  if(val("np")<iso(0))return toast("O prazo não pode estar no passado.");
  const y=iso(0).slice(2,4)+iso(0).slice(5,7),n=Math.max(0,...T().map(t=>+t.id.slice(-3)))+1,id="PED-"+y+"-"+String(n).padStart(3,"0");
  const t={id,cli:val("nc"),crit:val("nk"),tipo:val("nt"),esp:val("ne"),dim:val("nd")||"A definir",ent:iso(0),prazo:val("np"),prio:"Média",just:"Aguardando definição do PCP (RN05)",et:0,set:"Comercial",resp:def("Comercial"),obs:"Sem pendências",st:"Aberto",su:1,inj:2,fam:val("nf"),ap:false,mat:false,qa:"",pend:null,ret:0,ord:99,h:[]};
  log(t,"Pedido registrado.");T().push(t);notify(t,"Novo pedido sem prioridade definida: aguardando o PCP.");sv();fechar();tab="lista";render();toast("Ticket "+id+" criado.",0)}
init();
