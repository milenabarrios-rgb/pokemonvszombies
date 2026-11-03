(() => {
const canvas=document.getElementById('board'),ctx=canvas.getContext('2d');
const $=id=>document.getElementById(id);
const W=1350,H=760,ROWS=5,COLS=9,L=32,T=44,CW=145,CH=136;
const art=id=>`https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${id}.png`;
const mons={
 bulbasaur:{id:1,name:'Bulbasaur',cost:100,hp:150,range:540,cd:1.7,move:'Látigo Cepa',power:'vine',damage:26,secondary:'Somnífero'},
 sylveon:{id:700,name:'Sylveon',cost:125,hp:125,range:470,cd:2.1,move:'Viento Feérico',power:'fairy',damage:22,secondary:'Beso Drenaje'},
 rowlet:{id:722,name:'Rowlet',cost:100,hp:115,range:570,cd:1.25,move:'Follaje',power:'leaf',damage:17,secondary:'Picotazo'},
 cleffa:{id:173,name:'Cleffa',cost:75,hp:90,range:0,cd:7,move:'Canto',power:'song',damage:0,secondary:'Aturde en área'},
 kirlia:{id:281,name:'Kirlia',cost:125,hp:115,range:500,cd:2.3,move:'Confusión',power:'psychic',damage:18,secondary:'Ralentiza'},
 flareon:{id:136,name:'Flareon',cost:150,hp:165,range:245,cd:1.35,move:'Ascuas',power:'fire',damage:34,secondary:'Colmillo Ígneo'},
 ninetales:{id:38,name:'Ninetales',cost:175,hp:155,range:490,cd:3.1,move:'Fuego Fatuo',power:'ghostfire',damage:23,secondary:'Giro Fuego'}
};
const images={};Object.values(mons).forEach(m=>{const im=new Image();im.crossOrigin='anonymous';im.src=art(m.id);images[m.id]=im;});
const zombieSprite=new Image();zombieSprite.src='assets/zombie.webp';
let selected='bulbasaur',balls=250,lives=5,level=1,waveSpawn=0,spawnClock=0,breakClock=1,ballClock=2,paused=true,started=false,gameOver=false;
let placed=[],zombies=[],shots=[],pickups=[],effects=[],zid=0,last=0;
const cell=(r,c)=>({x:L+c*CW+CW/2,y:T+r*CH+CH/2});
function hud(){$('balls').textContent=balls;$('lives').textContent=lives;$('level').textContent=level;$('wave').textContent=level;}
function cards(){
 $('seedList').innerHTML='';
 Object.entries(mons).forEach(([key,m])=>{
  const b=document.createElement('button');b.className='seed'+(selected===key?' selected':'');
  b.innerHTML=`<img src="${art(m.id)}" alt="${m.name}"><span><span class="name">${m.name}</span><span class="type">${m.move} · ${m.secondary}</span></span><span class="cost">${m.cost}</span>`;
  b.onclick=()=>{if(paused||gameOver)return;selected=key;cards();};$('seedList').appendChild(b);
 });
}
function place(r,c){if(placed.some(p=>p.r===r&&p.c===c))return;const m=mons[selected];if(balls<m.cost){$('status').textContent='No tenés suficientes Poké Balls';return;}balls-=m.cost;const q=cell(r,c);placed.push({key:selected,r,c,x:q.x,y:q.y,hp:m.hp,max:m.hp,cd:.6,drain:0});hud();$('status').textContent=`${m.name} está defendiendo el jardín`;}
function click(e){if(paused||gameOver)return;const rect=canvas.getBoundingClientRect(),x=(e.clientX-rect.left)*W/rect.width,y=(e.clientY-rect.top)*H/rect.height;
 for(let i=pickups.length-1;i>=0;i--){let p=pickups[i];if(Math.hypot(x-p.x,y-p.y)<31){balls+=p.value;pickups.splice(i,1);hud();$('status').textContent='¡Poké Ball recolectada!';return;}}
 const c=Math.floor((x-L)/CW),r=Math.floor((y-T)/CH);if(r>=0&&r<ROWS&&c>=0&&c<COLS)place(r,c);
}
canvas.addEventListener('pointerdown',click);
function spawnZombie(){const r=Math.floor(Math.random()*ROWS),hp=95+level*24;zombies.push({id:++zid,r,x:W+30,y:cell(r,0).y,hp,max:hp,speed:18+level*1.6,attack:0,sleep:0,slow:0,burn:0,spin:0});}
function spawnBall(){const r=Math.floor(Math.random()*ROWS),c=1+Math.floor(Math.random()*(COLS-1)),p=cell(r,c);pickups.push({x:p.x+(Math.random()-.5)*70,y:p.y+(Math.random()-.5)*65,bob:Math.random()*6,value:25});}
function projectile(u,m,z,move=m.move,damage=m.damage){shots.push({x:u.x+40,y:u.y-12,target:z.id,damage,move,speed:move==='Follaje'?430:320,drain:m.power==='fairy'});}
function usePower(u,m,z){
 if(m.power==='song'){zombies.filter(a=>a.r===u.r&&Math.abs(a.x-u.x)<210).forEach(a=>a.sleep=3);effects.push({x:u.x,y:u.y,text:'♫ CANTO',t:1.1});u.cd=m.cd;return;}
 if(m.power==='fairy'){projectile(u,m,z);zombies.filter(a=>a.r===z.r&&Math.abs(a.x-z.x)<105&&a.id!==z.id).forEach(a=>a.hp-=m.damage*.65);u.drain=2;}
 else if(m.power==='psychic'){projectile(u,m,z);z.slow=3;}
 else if(m.power==='ghostfire'){projectile(u,m,z,'Fuego Fatuo',m.damage);z.burn=3;zombies.filter(a=>a.r===z.r&&Math.abs(a.x-z.x)<115&&a.id!==z.id).forEach(a=>a.burn=2);}
 else if(m.power==='fire'){
  if(z.x-u.x<125){z.hp-=58;z.burn=3;effects.push({x:z.x,y:z.y-42,text:'COLMILLO ÍGNEO',t:.65});}
  else{projectile(u,m,z,'Ascuas',m.damage);z.burn=2;}
 }
 else projectile(u,m,z);
 u.cd=m.cd;
}
function update(dt){
 if(paused||gameOver)return;
 if(waveSpawn>0){spawnClock-=dt;if(spawnClock<=0){spawnZombie();waveSpawn--;spawnClock=Math.max(.75,1.7-level*.06);}}
 else if(zombies.length===0){breakClock-=dt;if(breakClock<=0){level++;waveSpawn=5+level*2;spawnClock=.8;breakClock=3;balls+=35;hud();$('status').textContent=`¡Comienza la oleada ${level}!`;}}
 ballClock-=dt;if(ballClock<=0){spawnBall();ballClock=6+Math.random()*3;}
 placed.forEach(u=>{const m=mons[u.key];u.cd-=dt;if(m.power==='song'){if(u.cd<=0){balls+=15;hud();u.cd=9;}return;}
  let target=zombies.filter(z=>z.r===u.r&&z.x>u.x-5&&z.x-u.x<m.range).sort((a,b)=>a.x-b.x)[0];if(target&&u.cd<=0)usePower(u,m,target);
 });
 shots.forEach(s=>{const z=zombies.find(a=>a.id===s.target);if(!z){s.dead=true;return;}let dx=z.x-s.x,dy=z.y-s.y,d=Math.hypot(dx,dy);if(d<13){z.hp-=s.damage;s.dead=true;if(s.drain){balls+=8;hud();effects.push({x:s.x,y:s.y-25,text:'+8 energía',t:.6});}if(s.move==='Fuego Fatuo'){z.burn=3;zombies.filter(a=>a.r===z.r&&Math.abs(a.x-z.x)<125&&a.id!==z.id).forEach(a=>{a.burn=2;a.hp-=12;});}effects.push({x:z.x,y:z.y-35,text:s.move==='Fuego Fatuo'?'🔥':'✦',t:.45});}else{s.x+=dx/d*s.speed*dt;s.y+=dy/d*s.speed*dt;}});
 shots=shots.filter(s=>!s.dead);
 zombies.forEach(z=>{if(z.sleep>0){z.sleep-=dt;return;}if(z.burn>0){z.burn-=dt;z.hp-=8*dt;}if(z.slow>0)z.slow-=dt;if(z.spin>0)z.spin-=dt;
  const blocker=placed.find(u=>u.r===z.r&&Math.abs(u.x-z.x)<54);
  if(blocker){z.attack-=dt;if(z.attack<=0){blocker.hp-=20;z.attack=.8;}}
  else z.x-=z.speed*(z.slow>0?.45:1)*dt;
 });
 zombies=zombies.filter(z=>z.hp>0);
 placed=placed.filter(u=>u.hp>0);
 zombies=zombies.filter(z=>{if(z.x<L-15){lives--;hud();return false;}return true;});
 effects.forEach(a=>a.t-=dt);effects=effects.filter(a=>a.t>0);
 if(lives<=0)finish(false);
}
function rounded(x,y,w,h,r,color){ctx.fillStyle=color;ctx.beginPath();ctx.roundRect(x,y,w,h,r);ctx.fill();}
function draw(){
 ctx.clearRect(0,0,W,H);
 // césped en cuadros, como el tablero clásico
 ctx.fillStyle='#178b20';ctx.fillRect(0,0,W,H);
 for(let r=0;r<ROWS;r++)for(let c=0;c<COLS;c++){let x=L+c*CW,y=T+r*CH;ctx.fillStyle=(r+c)%2?'#21a52a':'#279f28';ctx.fillRect(x,y,CW,CH);ctx.fillStyle='#ffffff08';ctx.fillRect(x+3,y+3,CW-6,CH-6);
  for(let k=0;k<13;k++){let gx=x+(k*37+13)%CW,gy=y+(k*53+27)%CH;ctx.fillStyle=k%3?'#147e2540':'#b2d85b55';ctx.beginPath();ctx.arc(gx,gy,k%4+1,0,Math.PI*2);ctx.fill();}
 }
 // borde de jardín y vallas
 ctx.strokeStyle='#315f2c';ctx.lineWidth=12;ctx.strokeRect(L,T,COLS*CW,ROWS*CH);
 ctx.fillStyle='#d7d0b4';ctx.fillRect(0,0,W,35);for(let x=10;x<W;x+=85){rounded(x,0,42,45,7,'#e8e0c7');ctx.fillStyle='#b4aa8d';ctx.fillRect(x+18,0,5,43);}
 // cortacésped decorativos
 for(let r=0;r<ROWS;r++){let y=cell(r,0).y;ctx.font='30px sans-serif';ctx.fillText('🚜',3,y+12);}
 // plantas con ilustración oficial, no emojis
 placed.forEach(u=>{let m=mons[u.key],im=images[m.id];ctx.fillStyle='#0003';ctx.beginPath();ctx.ellipse(u.x,u.y+42,47,12,0,0,Math.PI*2);ctx.fill();if(im.complete&&im.naturalWidth){ctx.drawImage(im,u.x-48,u.y-56,96,96);}else{ctx.fillStyle='#fff';ctx.font='bold 15px sans-serif';ctx.textAlign='center';ctx.fillText(m.name,u.x,u.y);}
  rounded(u.x-38,u.y-62,76,7,3,'#573a31');rounded(u.x-38,u.y-62,76*Math.max(0,u.hp/u.max),3,'#6de46b');
 });
 zombies.forEach(z=>{ctx.save();ctx.translate(z.x,z.y);
  // Sprite transparente suministrado por el equipo: zombie clásico con traje.
  const zw=94, zh=151;
  if(zombieSprite.complete && zombieSprite.naturalWidth){ctx.drawImage(zombieSprite,-zw/2,-zh+38,zw,zh);}
  else{ctx.fillStyle='#66746a';ctx.beginPath();ctx.arc(0,-22,21,0,Math.PI*2);ctx.fill();rounded(-23,-5,46,55,12,'#58685d');}
  rounded(-31,-zh+20,62,7,3,'#503a35');rounded(-31,-zh+20,62*Math.max(0,z.hp/z.max),4,2,'#e85d52');
  if(z.sleep>0){ctx.fillStyle='#fff4a8';ctx.font='bold 22px sans-serif';ctx.fillText('Zzz',25,-zh+8);}
  if(z.burn>0){ctx.font='20px sans-serif';ctx.fillText('🔥',-32,-zh+5);}
  ctx.restore();});
 shots.forEach(s=>{ctx.fillStyle='#b5ec62';ctx.beginPath();ctx.ellipse(s.x,s.y,11,5,-.4,0,Math.PI*2);ctx.fill();});
 pickups.forEach(p=>{p.bob+=.06;let y=p.y+Math.sin(p.bob)*5;ctx.save();ctx.translate(p.x,y);
  ctx.shadowColor='#173b14aa';ctx.shadowBlur=10;ctx.shadowOffsetY=4;
  ctx.fillStyle='#f4eee0';ctx.beginPath();ctx.arc(0,0,20,0,Math.PI*2);ctx.fill();
  ctx.shadowColor='transparent';ctx.fillStyle='#e9434b';ctx.beginPath();ctx.arc(0,0,20,Math.PI,0);ctx.closePath();ctx.fill();
  ctx.strokeStyle='#282323';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(-19,0);ctx.lineTo(19,0);ctx.stroke();
  ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(0,0,7.5,0,Math.PI*2);ctx.fill();
  ctx.strokeStyle='#282323';ctx.lineWidth=3;ctx.beginPath();ctx.arc(0,0,7.5,0,Math.PI*2);ctx.stroke();
  ctx.fillStyle='#ffffff99';ctx.beginPath();ctx.ellipse(-8,-11,5,2,-.6,0,Math.PI*2);ctx.fill();
  ctx.restore();});
 effects.forEach(a=>{ctx.globalAlpha=Math.min(1,a.t*2);ctx.fillStyle='#fff7b4';ctx.font='bold 22px Nunito';ctx.textAlign='center';ctx.fillText(a.text,a.x,a.y-a.t*22);ctx.globalAlpha=1;});
}
function finish(win){gameOver=true;paused=true;show(win?'¡JARDÍN SALVADO!':'¡LOS ZOMBIES ENTRARON!',win?'¡Qué gran equipo Pokémon!':'Se terminaron las vidas. ¡Intenten otra vez!', 'Volver a jugar',reset);}
function show(title,msg,btn,fn){$('overlayTitle').textContent=title;$('overlayText').textContent=msg;$('overlayAction').textContent=btn;$('overlayAction').onclick=fn;$('overlay').classList.remove('hidden');}
function reset(){selected='bulbasaur';balls=250;lives=5;level=1;waveSpawn=0;spawnClock=0;breakClock=1;ballClock=2;placed=[];zombies=[];shots=[];pickups=[];effects=[];gameOver=false;paused=false;started=true;cards();hud();$('overlay').classList.add('hidden');$('status').textContent='¡Defendé el jardín!';}
$('overlayAction').onclick=()=>{reset();waveSpawn=7;};$('pause').onclick=()=>{if(!started||gameOver)return;paused=!paused;$('pause').textContent=paused?'▶ SEGUIR':'Ⅱ PAUSA';if(paused)show('JUEGO PAUSADO','El jardín queda en pausa.','Seguir jugando',()=>{$('overlay').classList.add('hidden');paused=false;$('pause').textContent='Ⅱ PAUSA';});else $('overlay').classList.add('hidden');};
$('menu').onclick=()=>show('MENÚ','Pokémon vs Zombies · Una aventura de Oli, Lu y Mile.','Volver al juego',()=>{$('overlay').classList.add('hidden');if(!started){reset();waveSpawn=7;}}); 
cards();hud();function loop(t){let dt=Math.min((t-last)/1000||.016,.04);last=t;update(dt);draw();requestAnimationFrame(loop);}requestAnimationFrame(loop);
})();