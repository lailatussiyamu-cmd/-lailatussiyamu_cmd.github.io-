// Ocean layer — sunlit surface at the top of the page, glowing deep sea further down.
// Scroll position sets --depth (0..1); the gauge reads it as metres.
// Fish are simulated on a canvas: each has a jointed spine that follows its head, a travelling
// body wave whose speed tracks swim speed, wandering steering, and small fish school (boids).
(function(){
  var oc=document.getElementById('ocean');
  if(!oc)return;
  var small=innerWidth<700;
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;

  function jelly(c){
    return '<svg viewBox="0 0 60 110"><path d="M4 30 C 4 4, 56 4, 56 30 C 48 35, 12 35, 4 30z" fill="'+c+'" opacity=".75"/>'+
      '<path d="M14 33 q-5 16 2 30 q6 14 -1 30 M25 34 q5 18 -2 34 M35 34 q-5 18 2 34 q5 12 -2 22 M46 33 q5 16 -2 30" stroke="'+c+'" stroke-width="2" fill="none" opacity=".6" stroke-linecap="round"/>'+
      '<ellipse cx="22" cy="17" rx="8" ry="4" fill="#fff" opacity=".4"/></svg>';
  }
  var h='<div class="tint"></div><div class="rays"><i></i><i></i><i></i><i></i></div><canvas class="swim"></canvas>';
  h+='<div class="jelly" style="left:78%;top:22vh;width:'+(small?34:52)+'px;--d:11s">'+jelly('#ff8fc8')+'</div>';
  h+='<div class="jelly" style="left:9%;top:58vh;width:'+(small?28:40)+'px;--d:13s">'+jelly('#8f7cff')+'</div>';
  h+='<div class="plankton">';
  var pc=['#3fd6c6','#8f7cff','#ff8fc8','#6fb6ff','#f2e14b'];
  for(var i=0;i<(small?18:34);i++)h+='<i style="left:'+((i*37+11)%100)+'%;top:'+((i*53+7)%100)+'%;--s:'+(2+i%3)+'px;--c:'+pc[i%5]+';--dur:'+(3+i%5)+'s;--delay:-'+(i%7)+'s"></i>';
  h+='</div><div class="bubbles">';
  for(var j=0;j<(small?10:18);j++)h+='<i style="left:'+((j*61+5)%100)+'%;--s:'+(4+(j%4)*3)+'px;--dur:'+(9+(j%5)*2)+'s;--delay:-'+((j*1.7)%12).toFixed(1)+'s"></i>';
  h+='</div><div class="abyss"></div><div class="gauge">Depth <b>0 m</b></div>';
  oc.innerHTML=h;

  /* ---------- depth from scroll ---------- */
  var depth=0,gauge=oc.querySelector('.gauge b'),lastShown=-1;
  function readDepth(){
    var max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    depth=Math.min(1,Math.max(0,scrollY/max));
    if(Math.abs(depth-lastShown)>=.002){lastShown=depth;oc.style.setProperty('--depth',depth.toFixed(3));gauge.textContent=Math.round(depth*200)+' m'}
  }

  /* ---------- fish simulation ---------- */
  var cv=oc.querySelector('canvas.swim'),ctx=cv.getContext('2d'),W=0,H=0,dpr=1;
  function size(){dpr=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
  size();

  var rnd=function(a,b){return a+Math.random()*(b-a)};
  var TAU=Math.PI*2;
  function angDiff(a,b){var d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d}

  // layer: near (big, bright), far (small, faint), deep (appears with depth)
  function Fish(o){
    this.len=o.len;this.w=o.len*o.fat;this.n=o.seg||10;this.seg=this.len/(this.n-1);
    this.x=o.x!=null?o.x:rnd(0,W);this.y=o.y!=null?o.y:rnd(H*.1,H*.9);
    this.a=o.a!=null?o.a:(Math.random()<.5?0:Math.PI)+rnd(-.3,.3);
    this.v0=o.v;this.v=o.v;this.burst=0;this.wan=0;this.turn=0;this.ph=rnd(0,TAU);
    this.c1=o.c1;this.c2=o.c2;this.layer=o.layer;this.par=o.par;this.school=o.school||null;
    this.p=[];for(var i=0;i<this.n;i++)this.p.push({x:this.x-Math.cos(this.a)*this.seg*i,y:this.y-Math.sin(this.a)*this.seg*i});
  }
  Fish.prototype.alpha=function(){
    if(this.layer==='near')return .9-depth*.45;
    if(this.layer==='far')return .42+depth*.15;
    return Math.max(0,Math.min(.85,depth*1.6-.35));
  };
  Fish.prototype.update=function(dt,ptr){
    var ax=Math.cos(this.a),ay=Math.sin(this.a),fx=ax*1.4,fy=ay*1.4;
    // wander: a slowly drifting preferred heading
    this.wan+=rnd(-.35,.35)*dt;this.wan=Math.max(-1.4,Math.min(1.4,this.wan*.995));
    fx+=Math.cos(this.a+this.wan)*.7;fy+=Math.sin(this.a+this.wan)*.7;
    // fish mostly swim level: steep climbs/dives get pulled back
    fy-=ay*(Math.abs(ay)>.5?1.6:.8);
    // soft bounds (a little off-screen is allowed)
    var m=Math.max(60,this.len);
    if(this.x<-m)fx+=(-m-this.x)/80; if(this.x>W+m)fx-=(this.x-W-m)/80;
    if(this.y<H*.06)fy+=(H*.06-this.y)/60; if(this.y>H*.94)fy-=(this.y-H*.94)/60;
    // schooling (boids)
    if(this.school){
      var cx=0,cy=0,vx=0,vy=0,sx=0,sy=0,k=0,R=this.len*4.5;
      for(var i=0;i<this.school.length;i++){var o=this.school[i];if(o===this)continue;
        var dx=o.x-this.x,dy=o.y-this.y,d=Math.hypot(dx,dy);if(d>R)continue;
        k++;cx+=dx;cy+=dy;vx+=Math.cos(o.a);vy+=Math.sin(o.a);
        if(d<this.len*1.3){sx-=dx/(d+.1);sy-=dy/(d+.1)}}
      if(k){fx+=cx/k/R*1.2+vx/k*1.1+sx*1.6;fy+=cy/k/R*1.2+vy/k*1.1+sy*1.6}
    }
    // shy of the pointer
    if(ptr.on){var px=this.x-ptr.x,py=this.y-ptr.y,pd=Math.hypot(px,py),rr=150+this.len;
      if(pd<rr){var s=(rr-pd)/rr;fx+=px/pd*s*4;fy+=py/pd*s*4;this.burst=Math.max(this.burst,s*1.6)}}
    // turn toward the desired heading at a limited rate
    var want=Math.atan2(fy,fx),diff=angDiff(this.a,want),maxT=(.03+this.burst*.03)*dt;
    var t=Math.max(-maxT,Math.min(maxT,diff));this.a+=t;this.turn=this.turn*.9+t*.1;
    // speed: occasional dart, then glide back down
    if(Math.random()<.0025*dt)this.burst=rnd(.6,1.4);
    this.burst*=Math.pow(.97,dt);
    this.v+=(this.v0*(1+this.burst)-this.v)*.06*dt;
    this.x+=Math.cos(this.a)*this.v*dt;this.y+=Math.sin(this.a)*this.v*dt;
    // spine follows the head
    var p=this.p;p[0].x=this.x;p[0].y=this.y;
    for(i=1;i<this.n;i++){var ddx=p[i].x-p[i-1].x,ddy=p[i].y-p[i-1].y,dd=Math.hypot(ddx,ddy)||1;
      p[i].x=p[i-1].x+ddx/dd*this.seg;p[i].y=p[i-1].y+ddy/dd*this.seg}
    // tail beat speeds up with swim speed
    this.ph+=(.09+this.v*.11)*dt;
  };
  Fish.prototype.draw=function(){
    var al=this.alpha();if(al<=.01)return;
    var p=this.p,n=this.n,L=[],R=[],w=this.w,amp=w*(.32+this.burst*.15);
    for(var i=0;i<n;i++){
      var a=i===0?{x:Math.cos(this.a),y:Math.sin(this.a)}:(function(q,r){var dx=r.x-q.x,dy=r.y-q.y,d=Math.hypot(dx,dy)||1;return{x:dx/d,y:dy/d}})(p[i],p[i-1]);
      var nx=-a.y,ny=a.x,u=i/(n-1);
      var wave=Math.sin(this.ph-i*.75)*amp*Math.pow(u,1.4);
      var prof=u<.28?.5+.5*Math.sin(u/.28*Math.PI/2):1-(u-.28)/.72*.86;
      var cx=p[i].x+nx*wave,cy=p[i].y+ny*wave,hw=w*.5*prof;
      L.push({x:cx+nx*hw,y:cy+ny*hw,nx:nx,ny:ny,cx:cx,cy:cy,ax:a.x,ay:a.y});R.push({x:cx-nx*hw,y:cy-ny*hw});
    }
    ctx.globalAlpha=al;
    var hx=p[0].x+Math.cos(this.a)*w*.45,hy=p[0].y+Math.sin(this.a)*w*.45,t=L[n-1];
    // tail fin
    var bx=-t.ax,by=-t.ay,fl=w*1.05,sp=w*.8,flap=Math.sin(this.ph-n*.75)*.35;
    var tx=t.cx,ty=t.cy;
    ctx.beginPath();ctx.moveTo(tx,ty);
    ctx.quadraticCurveTo(tx+bx*fl*.4+t.nx*sp*.3,ty+by*fl*.4+t.ny*sp*.3,tx+bx*fl+t.nx*sp*(1+flap),ty+by*fl+t.ny*sp*(1+flap));
    ctx.quadraticCurveTo(tx+bx*fl*.55,ty+by*fl*.55,tx+bx*fl-t.nx*sp*(1-flap),ty+by*fl-t.ny*sp*(1-flap));
    ctx.quadraticCurveTo(tx+bx*fl*.4-t.nx*sp*.3,ty+by*fl*.4-t.ny*sp*.3,tx,ty);
    ctx.fillStyle=this.c2;ctx.globalAlpha=al*.7;ctx.fill();ctx.globalAlpha=al;
    // pectoral fins
    var pf=L[Math.round(n*.3)],pl=w*.55,fa=Math.sin(this.ph*1.3)*.5;
    ctx.fillStyle=this.c1;ctx.globalAlpha=al*.55;
    [1,-1].forEach(function(sd){ctx.beginPath();ctx.moveTo(pf.cx+pf.nx*w*.3*sd,pf.cy+pf.ny*w*.3*sd);
      ctx.lineTo(pf.cx+pf.nx*(w*.3+pl)*sd-pf.ax*pl*(.9+fa*sd),pf.cy+pf.ny*(w*.3+pl)*sd-pf.ay*pl*(.9+fa*sd));
      ctx.lineTo(pf.cx-pf.ax*pl*.5,pf.cy-pf.ay*pl*.5);ctx.closePath();ctx.fill()});
    ctx.globalAlpha=al;
    // body
    ctx.beginPath();ctx.moveTo(hx,hy);
    for(i=0;i<n;i++){var nxp=L[i+1]||L[i];ctx.quadraticCurveTo(L[i].x,L[i].y,(L[i].x+nxp.x)/2,(L[i].y+nxp.y)/2)}
    for(i=n-1;i>=0;i--){var nxr=R[i-1]||R[i];ctx.quadraticCurveTo(R[i].x,R[i].y,(R[i].x+nxr.x)/2,(R[i].y+nxr.y)/2)}
    ctx.closePath();
    var g=ctx.createLinearGradient(hx,hy,t.cx,t.cy);g.addColorStop(0,this.c1);g.addColorStop(1,this.c2);
    ctx.fillStyle=g;ctx.fill();
    // light along the back
    ctx.beginPath();ctx.moveTo(L[1].cx*.6+L[1].x*.4,L[1].cy*.6+L[1].y*.4);
    for(i=2;i<Math.round(n*.7);i++)ctx.lineTo(L[i].cx*.6+L[i].x*.4,L[i].cy*.6+L[i].y*.4);
    ctx.strokeStyle='rgba(255,255,255,.45)';ctx.lineWidth=Math.max(.8,w*.06);ctx.lineCap='round';ctx.stroke();
    // eye
    if(this.layer==='near'||this.len>40){var e=L[0],ex=p[0].x+Math.cos(this.a)*w*.12+e.nx*w*.16,ey=p[0].y+Math.sin(this.a)*w*.12+e.ny*w*.16;
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(ex,ey,Math.max(1.2,w*.09),0,TAU);ctx.fill();
      ctx.fillStyle='#101a49';ctx.beginPath();ctx.arc(ex+Math.cos(this.a)*w*.02,ey+Math.sin(this.a)*w*.02,Math.max(.7,w*.05),0,TAU);ctx.fill()}
    ctx.globalAlpha=1;
  };

  // manta: slow glide, wings beat like slow flight
  function Manta(){this.x=rnd(W*.2,W*.8);this.y=rnd(H*.35,H*.7);this.a=Math.random()<.5?0:Math.PI;this.v=.35;this.ph=0;this.wan=0;this.s=small?.6:1;this.par=.15}
  Manta.prototype.update=function(dt){
    this.wan+=rnd(-.2,.2)*dt;this.wan*=.99;
    var want=this.a+this.wan*.02;
    if(this.x<-200)want=0;if(this.x>W+200)want=Math.PI;
    if(this.y<H*.25)want+=angDiff(this.a,Math.PI/2)*.02;if(this.y>H*.8)want+=angDiff(this.a,-Math.PI/2)*.02;
    this.a+=Math.max(-.01*dt,Math.min(.01*dt,angDiff(this.a,want)));
    this.x+=Math.cos(this.a)*this.v*dt;this.y+=Math.sin(this.a)*this.v*dt;this.ph+=.025*dt;
  };
  Manta.prototype.draw=function(){
    var al=Math.max(0,Math.min(.6,depth*1.4-.3));if(al<=.01)return;
    var s=this.s,flap=Math.sin(this.ph),span=150*s,ch=70*s;
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.a);ctx.globalAlpha=al;
    var tipF=-ch*.15+flap*ch*.35,tipY=span*(.92+.08*Math.cos(this.ph));
    ctx.beginPath();ctx.moveTo(ch*.55,0);
    ctx.bezierCurveTo(ch*.5,-tipY*.35,tipF+ch*.1,-tipY*.9,tipF,-tipY);
    ctx.bezierCurveTo(-ch*.25,-tipY*.7,-ch*.55,-tipY*.25,-ch*.6,0);
    ctx.bezierCurveTo(-ch*.55,tipY*.25,-ch*.25,tipY*.7,tipF,tipY);
    ctx.bezierCurveTo(tipF+ch*.1,tipY*.9,ch*.5,tipY*.35,ch*.55,0);ctx.closePath();
    var g=ctx.createLinearGradient(0,-tipY,0,tipY);g.addColorStop(0,'#8f7cff');g.addColorStop(.5,'#6f86ff');g.addColorStop(1,'#3fd6c6');
    ctx.fillStyle=g;ctx.fill();
    ctx.strokeStyle='#8f7cff';ctx.lineWidth=5*s;ctx.lineCap='round';
    ctx.beginPath();ctx.moveTo(ch*.5,-ch*.12);ctx.lineTo(ch*.75,-ch*.2);ctx.moveTo(ch*.5,ch*.12);ctx.lineTo(ch*.75,ch*.2);ctx.stroke();
    ctx.lineWidth=2*s;ctx.beginPath();ctx.moveTo(-ch*.6,0);ctx.quadraticCurveTo(-ch*1.2,Math.sin(this.ph*1.5)*8*s,-ch*1.7,0);ctx.stroke();
    ctx.restore();ctx.globalAlpha=1;
  };

  var fish=[],schools=[];
  function makeSchool(count,o){
    var arr=[],cx=rnd(W*.2,W*.8),cy=o.y*H,a=Math.random()<.5?0:Math.PI;
    for(var i=0;i<count;i++){var f=new Fish({len:o.len*rnd(.85,1.15),fat:.32,seg:7,v:o.v*rnd(.9,1.1),x:cx+rnd(-60,60),y:cy+rnd(-30,30),a:a+rnd(-.2,.2),c1:o.c1,c2:o.c2,layer:o.layer,par:o.par});arr.push(f);fish.push(f)}
    arr.forEach(function(f){f.school=arr});schools.push(arr);
  }
  makeSchool(small?6:10,{len:small?16:20,v:1.1,y:.32,c1:'#6fb6ff',c2:'rgba(63,214,198,.25)',layer:'far',par:.25});
  makeSchool(small?5:8,{len:small?14:18,v:1,y:.7,c1:'#8f7cff',c2:'rgba(255,143,200,.25)',layer:'deep',par:.3});
  [['#3fd6c6','rgba(111,182,255,.3)',small?52:76,.9],['#ff8fc8','rgba(143,124,255,.3)',small?46:64,.8],['#f2e14b','rgba(63,214,198,.3)',small?34:46,1.1]]
    .forEach(function(c,i){fish.push(new Fish({len:c[2],fat:.36,seg:11,v:c[3],c1:c[0],c2:c[1],layer:i<2?'near':'far',par:i<2?.55:.3,y:H*(.2+i*.25)}))});
  var manta=new Manta();

  /* ---------- loop ---------- */
  var ptr={x:0,y:0,on:false},lastY=scrollY,last=performance.now(),raf=0,visible=!document.hidden;
  if(matchMedia('(pointer:fine)').matches){
    addEventListener('pointermove',function(e){ptr.x=e.clientX;ptr.y=e.clientY;ptr.on=true},{passive:true});
    document.addEventListener('pointerleave',function(){ptr.on=false});
  }
  function scrollShift(){
    var dy=scrollY-lastY;lastY=scrollY;if(!dy)return;
    // swimming down the page: the sea moves up past you
    fish.concat([manta]).forEach(function(f){
      var s=-dy*f.par;f.y+=s;if(f.p)f.p.forEach(function(q){q.y+=s});
      var wrap=0;if(f.y<-120)wrap=H+240;else if(f.y>H+120)wrap=-(H+240);
      if(wrap){f.y+=wrap;if(f.p)f.p.forEach(function(q){q.y+=wrap})}
    });
  }
  function frame(now){
    var dt=Math.min(3,(now-last)/16.67);last=now;
    scrollShift();
    ctx.clearRect(0,0,W,H);
    manta.update(dt);manta.draw();
    for(var i=0;i<fish.length;i++){fish[i].update(dt,ptr)}
    // far/deep first, near on top
    fish.forEach(function(f){if(f.layer!=='near')f.draw()});
    fish.forEach(function(f){if(f.layer==='near')f.draw()});
    raf=(visible&&!still)?requestAnimationFrame(frame):0;
  }
  function start(){if(!raf){last=performance.now();raf=requestAnimationFrame(frame)}}

  addEventListener('scroll',function(){readDepth();if(still)requestAnimationFrame(frame)},{passive:true});
  addEventListener('resize',function(){size();readDepth();if(still)requestAnimationFrame(frame)});
  document.addEventListener('visibilitychange',function(){visible=!document.hidden;oc.classList.toggle('paused',!visible);if(visible)start()});
  readDepth();
  if(still){for(var k=0;k<40;k++)fish.forEach(function(f){f.update(1,ptr)});requestAnimationFrame(frame)}else start();
})();
