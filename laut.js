// Ocean layer — sunlit surface at the top of the page, glowing deep sea further down.
// Scroll position sets --depth (0..1); the gauge reads it as metres.
(function(){
  var oc=document.getElementById('ocean');
  if(!oc)return;
  var small=innerWidth<700, uid=0;

  function fish(c1,c2){
    var id='f'+(uid++);
    return '<svg viewBox="0 0 120 50"><defs><linearGradient id="'+id+'" x1="0" x2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset="1" stop-color="'+c2+'" stop-opacity=".15"/></linearGradient></defs>'+
      '<path d="M4 25 C 24 4, 70 2, 92 22 L 118 6 L 110 25 L 118 44 L 92 28 C 70 48, 24 46, 4 25z" fill="url(#'+id+')"/>'+
      '<path d="M18 22 C 40 14, 66 14, 86 24" stroke="rgba(255,255,255,.55)" stroke-width="1.4" fill="none" stroke-linecap="round"/>'+
      '<path d="M44 9 q12 -8 26 2" fill="'+c1+'" opacity=".55"/><circle cx="16" cy="22" r="2.4" fill="#fff"/></svg>';
  }
  var manta='<svg viewBox="0 0 300 120"><defs><linearGradient id="mt" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#8f7cff" stop-opacity=".55"/><stop offset="1" stop-color="#3fd6c6" stop-opacity=".2"/></linearGradient></defs>'+
    '<path d="M20 60 C 70 40, 110 18, 150 30 C 190 18, 230 40, 280 60 C 230 66, 200 80, 170 84 L 156 118 L 150 84 C 120 86, 70 72, 20 60z" fill="url(#mt)"/>'+
    '<path d="M136 34 q-6 -12 -2 -22 M164 34 q6 -12 2 -22" stroke="#8f7cff" stroke-opacity=".6" stroke-width="5" stroke-linecap="round" fill="none"/></svg>';
  function jelly(c){
    return '<svg viewBox="0 0 60 110"><path d="M4 30 C 4 4, 56 4, 56 30 C 48 35, 12 35, 4 30z" fill="'+c+'" opacity=".75"/>'+
      '<path d="M14 33 q-5 16 2 30 q6 14 -1 30 M25 34 q5 18 -2 34 M35 34 q-5 18 2 34 q5 12 -2 22 M46 33 q5 16 -2 30" stroke="'+c+'" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>'+
      '<ellipse cx="22" cy="17" rx="8" ry="4" fill="#fff" opacity=".4"/></svg>';
  }
  function school(n,c1,c2,size){
    var h='<span class="school">';
    for(var i=0;i<n;i++)h+='<i style="--dx:'+((i%4)*(size+8)+(i>3?14:0))+'px;--dy:'+(i>3?22:(i%2)*9)+'px;--d:'+((i*.41)%1.8).toFixed(2)+'s;width:'+size+'px">'+fish(c1,c2)+'</i>';
    return h+'</span>';
  }

  // [isi, top vh, lebar px, durasi s, jeda s, arah kiri?, lapisan]
  var lanes=[
    [fish('#3fd6c6','#6fb6ff'),18,small?60:84,34,-8,false,'dekat'],
    [fish('#ff8fc8','#8f7cff'),62,small?52:70,40,-22,true,'dekat'],
    [fish('#f2e14b','#3fd6c6'),40,small?40:54,30,-14,false,'jauh'],
    [school(7,'#6fb6ff','#3fd6c6',small?16:22),30,small?110:150,46,-30,true,'jauh'],
    [manta,46,small?200:320,70,-26,false,'dalam'],
    [school(6,'#8f7cff','#ff8fc8',small?14:18),74,small?100:130,52,-5,false,'dalam']
  ];
  if(small)lanes.splice(5,1);
  var h='<div class="tint"></div><div class="rays"><i></i><i></i><i></i><i></i></div><div class="caustic"></div>';
  lanes.forEach(function(l,i){
    var rest=l[5]?'calc(-55% - 170px)':'calc(45% + 170px)';
    h+='<div class="lane '+l[6]+(l[5]?' kiri':'')+'" style="top:'+l[1]+'vh;--dur:'+l[3]+'s;--delay:'+l[4]+'s;--rest:'+rest+'"><div class="bob" style="width:'+l[2]+'px;animation-delay:-'+i+'s">'+l[0]+'</div></div>';
  });
  h+='<div class="jelly" style="left:78%;top:22vh;width:'+(small?34:52)+'px;--d:11s">'+jelly('#ff8fc8')+'</div>';
  h+='<div class="jelly" style="left:9%;top:58vh;width:'+(small?28:40)+'px;--d:13s">'+jelly('#8f7cff')+'</div>';
  h+='<div class="plankton">';
  var pc=['#3fd6c6','#8f7cff','#ff8fc8','#6fb6ff','#f2e14b'];
  for(var i=0;i<(small?18:34);i++)h+='<i style="left:'+((i*37+11)%100)+'%;top:'+((i*53+7)%100)+'%;--s:'+(2+i%3)+'px;--c:'+pc[i%5]+';--dur:'+(3+i%5)+'s;--delay:-'+(i%7)+'s"></i>';
  h+='</div><div class="bubbles">';
  for(var j=0;j<(small?10:18);j++)h+='<i style="left:'+((j*61+5)%100)+'%;--s:'+(4+(j%4)*3)+'px;--dur:'+(9+(j%5)*2)+'s;--delay:-'+((j*1.7)%12).toFixed(1)+'s"></i>';
  h+='</div><div class="abyss"></div><div class="gauge">Depth <b>0 m</b></div>';
  oc.innerHTML=h;

  var gauge=oc.querySelector('.gauge b'),ticking=false,last=-1;
  function update(){
    ticking=false;
    var max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    var d=Math.min(1,Math.max(0,scrollY/max));
    if(Math.abs(d-last)<.002)return;
    last=d;
    oc.style.setProperty('--depth',d.toFixed(3));
    gauge.textContent=Math.round(d*200)+' m';
  }
  addEventListener('scroll',function(){if(!ticking){ticking=true;requestAnimationFrame(update)}},{passive:true});
  addEventListener('resize',update);
  document.addEventListener('visibilitychange',function(){oc.classList.toggle('paused',document.hidden)});
  update();
})();
