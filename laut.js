// Ocean layer — sunlit surface at the top of the page, glowing deep sea further down.
// Scroll position sets --depth (0..1); the gauge reads it as metres.
// Everything that moves is simulated on one canvas:
//  - fish: jointed spine led by the head, carangiform body wave (mostly in the rear third),
//    burst-and-coast swimming, smooth noise-driven steering, countershaded bodies, schooling (boids)
//  - jellyfish: bell contraction gives thrust, then a slow sink; verlet tentacles trail behind
//  - bubbles: released in clusters, accelerate as they rise, zig-zag, wobble and grow
//  - marine snow: slow sinking specks, glowing plankton in the deep
(function(){
  var oc=document.getElementById('ocean');
  if(!oc)return;
  var small=innerWidth<700;
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;

  oc.innerHTML='<div class="tint"></div><div class="rays"><i></i><i></i><i></i><i></i></div><canvas class="swim"></canvas><div class="abyss"></div><div class="gauge">Depth <b>0 m</b></div>';

  /* ---------- depth from scroll ---------- */
  var depth=0,gauge=oc.querySelector('.gauge b'),lastShown=-1;
  function readDepth(){
    var max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    depth=Math.min(1,Math.max(0,scrollY/max));
    if(Math.abs(depth-lastShown)>=.002){lastShown=depth;oc.style.setProperty('--depth',depth.toFixed(3));gauge.textContent=Math.round(depth*200)+' m'}
  }

  /* ---------- canvas ---------- */
  var cv=oc.querySelector('canvas.swim'),ctx=cv.getContext('2d'),W=0,H=0,dpr=1;
  function size(){dpr=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0)}
  size();

  var TAU=Math.PI*2,time=0;
  function rnd(a,b){return a+Math.random()*(b-a)}
  function clamp(v,a,b){return v<a?a:v>b?b:v}
  function angDiff(a,b){var d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d}
  // smooth 1-D noise from three detuned sines, roughly -1..1
  function Noise(){var a=rnd(.7,1.3),b=rnd(1.7,2.6),c=rnd(3.1,4.3),p=rnd(0,TAU),q=rnd(0,TAU),r=rnd(0,TAU);
    return function(t){return (Math.sin(t*a+p)+.55*Math.sin(t*b+q)+.25*Math.sin(t*c+r))/1.8}}

  /* ---------- bubbles ---------- */
  var bubbles=[];
  function bubble(x,y,r){if(bubbles.length<(small?45:90))bubbles.push({x:x,y:y,r:r,vy:-rnd(.1,.3),ph:rnd(0,TAU),f:rnd(.06,.11),wob:rnd(0,TAU),x0:x})}
  var vents=[];for(var vi=0;vi<(small?2:4);vi++)vents.push({x:rnd(.05,.95),t:rnd(0,200)});
  function updateBubbles(dt){
    vents.forEach(function(v){v.t-=dt;if(v.t<=0){
      var n=Math.round(rnd(2,6)),bx=v.x*W+rnd(-12,12);
      for(var i=0;i<n;i++)(function(i){setTimeout(function(){bubble(bx+rnd(-3,3),H+10,rnd(.7,i===0?2.8:1.9))},i*rnd(90,200))})(i);
      v.t=rnd(90,320);if(Math.random()<.25)v.x=rnd(.05,.95)}});
    for(var i=bubbles.length-1;i>=0;i--){var b=bubbles[i];
      var term=-(.45+b.r*.2);b.vy+=(term-b.vy)*.02*dt;          // accelerate to terminal rise speed
      b.ph+=b.f*dt*(1+b.r*.05);b.wob+=.18*dt;
      b.y+=b.vy*dt;b.x=b.x0+Math.sin(b.ph)*(b.r*1.4+.5);              // zig-zag, wider for bigger bubbles
      b.x0+=Math.sin(time*.004+b.y*.01)*.05*dt;                  // slight current
      b.r*=1+.0003*dt;                                           // expands as pressure drops
      if(b.y<-20)bubbles.splice(i,1)}
  }
  function drawBubbles(){
    for(var i=0;i<bubbles.length;i++){var b=bubbles[i],sq=Math.sin(b.wob)*.13,rx=b.r*(1+sq),ry=b.r*(1-sq);
      var fade=clamp(b.y/(H*.12),0,1);ctx.globalAlpha=.6*fade;
      ctx.beginPath();ctx.ellipse(b.x,b.y,rx,ry,Math.sin(b.ph)*.4,0,TAU);
      var g=ctx.createRadialGradient(b.x-rx*.35,b.y-ry*.4,0,b.x,b.y,b.r);
      g.addColorStop(0,'rgba(255,255,255,.55)');g.addColorStop(.45,'rgba(200,235,255,.08)');g.addColorStop(.9,'rgba(200,235,255,.18)');g.addColorStop(1,'rgba(230,248,255,.6)');
      ctx.fillStyle=g;ctx.fill();
      if(b.r>1.5){ctx.beginPath();ctx.arc(b.x-rx*.3,b.y-ry*.35,b.r*.22,0,TAU);ctx.fillStyle='rgba(255,255,255,.9)';ctx.fill()}}
    ctx.globalAlpha=1;
  }

  /* ---------- marine snow & deep plankton ---------- */
  var snow=[];for(var si=0;si<(small?35:70);si++)snow.push({x:rnd(0,1),y:rnd(0,1),r:rnd(.5,1.6),v:rnd(.02,.08),glow:Math.random()<.35,c:['#3fd6c6','#8f7cff','#ff8fc8','#6fb6ff','#f2e14b'][si%5],ph:rnd(0,TAU)});
  function drawSnow(dt){
    var gl=clamp(depth*1.7-.35,0,1);
    for(var i=0;i<snow.length;i++){var s=snow[i];
      s.y+=s.v*dt/H*3;s.x+=Math.sin(time*.01+s.ph)*.00008*dt;s.ph+=.02*dt;
      if(s.y>1.02){s.y=-.02;s.x=rnd(0,1)}
      var x=s.x*W,y=s.y*H;
      if(s.glow&&gl>0){var tw=.5+.5*Math.sin(s.ph*1.7);ctx.globalAlpha=gl*tw*.35;ctx.fillStyle=s.c;ctx.beginPath();ctx.arc(x,y,s.r*5,0,TAU);ctx.fill();ctx.globalAlpha=gl*tw;ctx.beginPath();ctx.arc(x,y,s.r*1.2,0,TAU);ctx.fill()}
      else{ctx.globalAlpha=.25;ctx.fillStyle='#dfe9ff';ctx.beginPath();ctx.arc(x,y,s.r*.7,0,TAU);ctx.fill()}}
    ctx.globalAlpha=1;
  }

  /* ---------- fish ---------- */
  // Fish live in a shallow 3-D slab (z = toward the viewer) and are drawn from the side.
  // The tail beats side to side (in z), so from the side it reads as a flickering, foreshortening
  // caudal fin; turning around is a yaw turn, so the body shortens and lengthens instead of looping.
  var PERS=1400,ZR=small?160:260;
  function proj(x,y,z){var k=PERS/(PERS-z);return{x:W/2+(x-W/2)*k,y:H/2+(y-H/2)*k,k:k}}
  function Fish(o){
    this.len=o.len;this.w=o.len*o.fat;this.n=o.seg||12;this.seg=this.len/(this.n-1);
    this.x=o.x!=null?o.x:rnd(0,W);this.y=o.y!=null?o.y:rnd(H*.15,H*.85);this.z=o.z!=null?o.z:rnd(-ZR,ZR);
    this.yaw=o.yaw!=null?o.yaw:(Math.random()<.5?0:Math.PI)+rnd(-.4,.4);this.course=this.yaw;this.pitch=0;
    this.v0=o.v;this.v=o.v*.6;this.thrust=.5;this.tT=.7;this.mode='swim';this.modeT=rnd(40,140);
    this.ph=rnd(0,TAU);this.nz=Noise();this.nzP=Noise();this.nzT=rnd(0,100);
    this.col=o.col;this.layer=o.layer;this.par=o.par;this.school=null;this.detail=o.detail;
    this.p=[];for(var i=0;i<this.n;i++)this.p.push({x:this.x-Math.cos(this.yaw)*this.seg*i,y:this.y,z:this.z-Math.sin(this.yaw)*this.seg*i});
  }
  Fish.prototype.alpha=function(k){
    var a=this.layer==='near'?.97-depth*.5:this.layer==='far'?.55+depth*.1:clamp(depth*1.7-.4,0,.9);
    return a*clamp(.6+(k-.86)*1.6,.45,1);                 // farther away = hazier
  };
  Fish.prototype.update=function(dt,ptr){
    // burst-and-coast
    this.modeT-=dt;
    if(this.modeT<=0){
      if(this.mode==='swim'){this.mode='coast';this.modeT=rnd(35,120);this.tT=rnd(0,.12)}
      else{this.mode='swim';this.modeT=rnd(50,170);this.tT=rnd(.45,1)}
    }
    this.nzT+=.006*dt;
    this.course+=this.nz(this.nzT)*.009*dt;
    // mostly side-on: the course relaxes toward left or right, with only brief turns toward/away from us
    this.course+=angDiff(this.course,Math.cos(this.course)>=0?0:Math.PI)*.012*dt;
    // desired heading in the horizontal plane (x,z)
    var dx=Math.cos(this.course),dz=Math.sin(this.course),m=Math.max(50,this.len);
    if(this.x<m)dx+=(m-this.x)/m*2.5; if(this.x>W-m)dx-=(this.x-W+m)/m*2.5;
    if(this.z>ZR)dz-=(this.z-ZR)/60; if(this.z<-ZR)dz+=(-ZR-this.z)/60;
    var pT=this.nzP(this.nzT*.7)*.14;
    if(this.y<H*.12)pT=.3; if(this.y>H*.88)pT=-.3;
    // schooling (boids, 3-D)
    if(this.school){
      var cx=0,cy=0,cz=0,ax=0,az=0,sx=0,sy=0,sz=0,k=0,R=this.len*5;
      for(var i=0;i<this.school.length;i++){var o=this.school[i];if(o===this)continue;
        var ex=o.x-this.x,ey=o.y-this.y,ez=o.z-this.z,d=Math.hypot(ex,ey,ez);if(d>R)continue;
        k++;cx+=ex;cy+=ey;cz+=ez;ax+=Math.cos(o.yaw);az+=Math.sin(o.yaw);
        if(d<this.len*1.4){var f=this.len/(d*d+1);sx-=ex*f;sy-=ey*f;sz-=ez*f}}
      if(k){dx+=cx/k/R*1.4+ax/k*1.3+sx*1.5;dz+=cz/k/R*1.4+az/k*1.3+sz*1.5;pT+=clamp((cy/k/R)*1.2+sy*.6,-.3,.3);
        if(Math.hypot(cx,cz)/k>this.len*2.5)this.tT=Math.max(this.tT,.8)}
    }
    var want=Math.atan2(dz,dx);
    this.course+=angDiff(this.course,want)*.04*dt;
    // startle from the pointer (screen space)
    if(ptr.on){var sp=proj(this.x,this.y,this.z),px=sp.x-ptr.x,py=sp.y-ptr.y,pd=Math.hypot(px,py),rr=110+this.len*1.6;
      if(pd<rr){want=px>0?rnd(-.3,.3):Math.PI+rnd(-.3,.3);this.course=want;pT=py>0?.35:-.35;this.mode='swim';this.modeT=60;this.tT=1.3}}
    // thrust & speed
    this.thrust+=(this.tT-this.thrust)*.06*dt;
    this.v+=(this.v0*(.25+this.thrust*1.05)-this.v)*(this.thrust>.2?.045:.008)*dt;
    // the tail does the turning: quick while beating, slow while gliding
    var maxT=(.004+this.thrust*.032)*dt;
    this.yaw+=clamp(angDiff(this.yaw,want),-maxT,maxT);
    this.pitch+=clamp(pT-this.pitch,-.006*dt,.006*dt);
    var cp=Math.cos(this.pitch);
    this.x+=cp*Math.cos(this.yaw)*this.v*dt;this.z+=cp*Math.sin(this.yaw)*this.v*dt;this.y+=Math.sin(this.pitch)*this.v*dt;
    var p=this.p;p[0].x=this.x;p[0].y=this.y;p[0].z=this.z;
    for(i=1;i<this.n;i++){var qx=p[i].x-p[i-1].x,qy=p[i].y-p[i-1].y,qz=p[i].z-p[i-1].z,qd=Math.hypot(qx,qy,qz)||1;
      p[i].x=p[i-1].x+qx/qd*this.seg;p[i].y=p[i-1].y+qy/qd*this.seg;p[i].z=p[i-1].z+qz/qd*this.seg}
    // tail-beat frequency: higher with thrust, lower for bigger fish
    this.ph+=(.04+this.thrust*.2)*Math.pow(30/this.len,.35)*dt;
    if(this.layer==='near'&&Math.random()<.0012*dt){var hp=proj(this.x,this.y,this.z);bubble(hp.x,hp.y,rnd(.7,1.4))}
  };
  Fish.prototype.draw=function(){
    var p=this.p,n=this.n,w=this.w,col=this.col,i,u;
    var P=[],UP=[],HW=[],LT=[],C3=[];
    var A=this.len*(.035+this.thrust*.09);                // tail-beat amplitude, sideways (z for a side-on fish)
    for(i=0;i<n;i++){
      var tx,tz,ty;if(i===0){tx=Math.cos(this.yaw);tz=Math.sin(this.yaw);ty=Math.sin(this.pitch)}else{tx=p[i-1].x-p[i].x;ty=p[i-1].y-p[i].y;tz=p[i-1].z-p[i].z;var tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl}
      u=i/(n-1);
      var lat=Math.sin(this.ph-u*TAU*.9)*A*(.06+.94*u*u);
      var c={x:p[i].x-tz*lat,y:p[i].y,z:p[i].z+tx*lat};C3.push(c);P.push(proj(c.x,c.y,c.z));
      HW.push(w*.5*(u<.3?.4+.6*Math.sin(u/.3*Math.PI/2):.14+.86*Math.pow(1-(u-.3)/.7,1.2))*P[i].k);
    }
    for(i=0;i<n;i++){
      var a=P[Math.max(0,i-1)],b=P[i===0?1:i],sx=a.x-b.x,sy=a.y-b.y,sl=Math.hypot(sx,sy)||1e-6;
      var lt=clamp(sl/(this.seg*P[i].k),0,1);LT.push(lt);
      var ux=sy/sl,uy=-sx/sl;if(uy>0){ux=-ux;uy=-uy}
      var mx=ux*lt,my=uy*lt-(1-lt),ml=Math.hypot(mx,my)||1;UP.push({x:mx/ml,y:my/ml,tx:sx/sl,ty:sy/sl});
    }
    var al=this.alpha(P[0].k);if(al<=.01)return;
    function side(i,k){return{x:P[i].x+UP[i].x*HW[i]*k,y:P[i].y+UP[i].y*HW[i]*k}}
    ctx.globalAlpha=al;
    // caudal fin: a vertical fin following the tail's swing, foreshortened by it
    var tb=C3[n-1],tp=C3[n-2],bx=tb.x-tp.x,by=tb.y-tp.y,bz=tb.z-tp.z,bl=Math.hypot(bx,by,bz)||1,fl=w*.8,fs=w*.62*P[n-1].k;
    var fe=proj(tb.x+bx/bl*fl,tb.y+by/bl*fl,tb.z+bz/bl*fl),T=P[n-1],U=UP[n-1],vx=fe.x-T.x,vy=fe.y-T.y;
    var root=side(n-2,0);
    var fg=ctx.createLinearGradient(root.x,root.y,fe.x,fe.y);fg.addColorStop(0,col.side);fg.addColorStop(.35,col.fin);fg.addColorStop(1,col.fin);
    ctx.beginPath();var r1=side(n-2,.9),r2=side(n-2,-.9);ctx.moveTo(r1.x,r1.y);
    ctx.quadraticCurveTo(T.x+vx*.45+U.x*fs*.5,T.y+vy*.45+U.y*fs*.5,T.x+vx+U.x*fs,T.y+vy+U.y*fs);
    ctx.quadraticCurveTo(T.x+vx*.62,T.y+vy*.62,T.x+vx-U.x*fs,T.y+vy-U.y*fs);
    ctx.quadraticCurveTo(T.x+vx*.45-U.x*fs*.5,T.y+vy*.45-U.y*fs*.5,r2.x,r2.y);ctx.closePath();
    ctx.fillStyle=fg;ctx.fill();
    if(this.detail){ctx.strokeStyle='rgba(255,255,255,.16)';ctx.lineWidth=.6;ctx.beginPath();
      for(var r=-3;r<=3;r++){var kk=r/3;ctx.moveTo(T.x,T.y);ctx.lineTo(T.x+vx*(.62+.38*Math.abs(kk))+U.x*fs*kk,T.y+vy*(.62+.38*Math.abs(kk))+U.y*fs*kk)}ctx.stroke()}
    // dorsal (top) and anal (bottom) fins
    function fin(i0,i1,k,h){var a0=side(i0,k*.9),a1=side(i1,k*.9),im=Math.round(i0*.6+i1*.4),am=side(im,k);
      var tipx=am.x+UP[im].x*HW[im]*h*k-UP[im].tx*HW[im]*.6,tipy=am.y+UP[im].y*HW[im]*h*k-UP[im].ty*HW[im]*.6;
      ctx.beginPath();ctx.moveTo(a0.x,a0.y);ctx.quadraticCurveTo(am.x+UP[im].x*HW[im]*h*k*.9,am.y+UP[im].y*HW[im]*h*k*.9,tipx,tipy);ctx.quadraticCurveTo((tipx+a1.x)/2,(tipy+a1.y)/2+0,a1.x,a1.y);ctx.closePath();ctx.fillStyle=col.fin;ctx.fill()}
    fin(Math.round(n*.3),Math.round(n*.6),1,.9);
    fin(Math.round(n*.6),Math.round(n*.78),-1,.6);
    // body
    var hx=P[0].x+UP[0].tx*HW[0]*.9*LT[0],hy=P[0].y+UP[0].ty*HW[0]*.9*LT[0];
    function outline(){ctx.beginPath();ctx.moveTo(hx,hy);
      for(var i=0;i<n;i++){var q=side(i,1),q2=side(Math.min(n-1,i+1),1);ctx.quadraticCurveTo(q.x,q.y,(q.x+q2.x)/2,(q.y+q2.y)/2)}
      for(i=n-1;i>=0;i--){var b=side(i,-1),b2=side(Math.max(0,i-1),-1);ctx.quadraticCurveTo(b.x,b.y,(b.x+b2.x)/2,(b.y+b2.y)/2)}
      ctx.quadraticCurveTo(hx,hy,hx,hy);ctx.closePath()}
    outline();ctx.fillStyle=col.side;ctx.fill();
    ctx.save();outline();ctx.clip();
    // countershading: dark back, pale belly
    ctx.beginPath();var q0=side(0,1.1);ctx.moveTo(q0.x,q0.y);
    for(i=1;i<n;i++){var q=side(i,1.1);ctx.lineTo(q.x,q.y)}
    for(i=n-1;i>=0;i--){var c=side(i,.12);ctx.lineTo(c.x,c.y)}
    ctx.closePath();ctx.fillStyle=col.back;ctx.globalAlpha=al*.85;ctx.fill();
    ctx.beginPath();q0=side(0,-1.1);ctx.moveTo(q0.x,q0.y);
    for(i=1;i<n;i++){q=side(i,-1.1);ctx.lineTo(q.x,q.y)}
    for(i=n-1;i>=0;i--){c=side(i,-.38);ctx.lineTo(c.x,c.y)}
    ctx.closePath();ctx.fillStyle=col.belly;ctx.globalAlpha=al*.7;ctx.fill();ctx.globalAlpha=al;
    if(this.detail&&LT[2]>.4){
      ctx.beginPath();var l0=side(2,.1);ctx.moveTo(l0.x,l0.y);for(i=3;i<n-1;i++){var l=side(i,.1);ctx.lineTo(l.x,l.y)}
      ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=Math.max(.6,w*.03);ctx.stroke();
      var gi=Math.round(n*.18),g1=side(gi,.8),g2=side(gi,-.8),gm=side(Math.max(0,gi-1),0);
      ctx.beginPath();ctx.moveTo(g1.x,g1.y);ctx.quadraticCurveTo(gm.x,gm.y,g2.x,g2.y);ctx.strokeStyle='rgba(16,26,73,.35)';ctx.lineWidth=Math.max(.6,w*.04);ctx.stroke();
    }
    if(this.glow&&depth>.4){ctx.fillStyle='#bff6ff';for(i=2;i<n-2;i+=2){var gp=side(i,-.3);ctx.globalAlpha=al*(.5+.5*Math.sin(time*.05+i));ctx.beginPath();ctx.arc(gp.x,gp.y,Math.max(.8,w*.05),0,TAU);ctx.fill()}ctx.globalAlpha=al}
    ctx.restore();
    // pectoral fin: paddles, more while gliding
    var pi=Math.round(n*.24),pc=side(pi,-.25),pl=w*.55*P[pi].k*(.5+.5*LT[pi]),pa=.5+.5*Math.sin(this.ph*.9)+(this.thrust<.2?.3:0);
    ctx.beginPath();ctx.moveTo(pc.x,pc.y);
    ctx.quadraticCurveTo(pc.x-UP[pi].tx*pl*.5-UP[pi].x*pl*pa*.6,pc.y-UP[pi].ty*pl*.5-UP[pi].y*pl*pa*.6,pc.x-UP[pi].tx*pl-UP[pi].x*pl*pa*.35,pc.y-UP[pi].ty*pl-UP[pi].y*pl*pa*.35);
    ctx.quadraticCurveTo(pc.x-UP[pi].tx*pl*.5,pc.y-UP[pi].ty*pl*.5,pc.x-UP[pi].tx*pl*.1,pc.y-UP[pi].ty*pl*.1);ctx.closePath();
    ctx.fillStyle=col.fin;ctx.globalAlpha=al*.85;ctx.fill();ctx.globalAlpha=al;
    // eye (only when the fish is more or less side-on)
    if((this.detail||this.len>26)&&LT[1]>.3){var e=side(1,.3),er=Math.max(1.1,w*.11*P[0].k);
      ctx.fillStyle='#f4f8ff';ctx.beginPath();ctx.arc(e.x,e.y,er,0,TAU);ctx.fill();
      ctx.fillStyle='#0b1238';ctx.beginPath();ctx.arc(e.x+UP[0].tx*er*.2,e.y+UP[0].ty*er*.2,er*.62,0,TAU);ctx.fill();
      ctx.fillStyle='#fff';ctx.beginPath();ctx.arc(e.x-er*.25,e.y-er*.3,er*.22,0,TAU);ctx.fill()}
    ctx.globalAlpha=1;
  };

  /* ---------- jellyfish ---------- */
  function Jelly(o){
    this.x=o.x;this.y=o.y;this.r=o.r;this.c=o.c;this.vx=0;this.vy=0;this.tilt=0;this.nz=Noise();
    this.period=rnd(150,210);this.t=rnd(0,this.period);this.sq=0;this.base=o.base;
    this.tent=[];var nt=small?6:8;
    for(var i=0;i<nt;i++){var pts=[],len=Math.round(rnd(12,16));for(var k=0;k<len;k++)pts.push({x:this.x,y:this.y+k*this.r*.28,ox:this.x,oy:this.y+k*this.r*.28});this.tent.push({pts:pts,k:i/(nt-1),seg:this.r*rnd(.24,.32)})}
    this.arms=[];for(i=0;i<3;i++){pts=[];for(k=0;k<9;k++)pts.push({x:this.x,y:this.y+k*this.r*.25,ox:this.x,oy:this.y+k*this.r*.25});this.arms.push({pts:pts,k:(i+1)/4,seg:this.r*.26})}
  }
  Jelly.prototype.alpha=function(){return clamp(this.base+depth*.75,0,.9)};
  Jelly.prototype.update=function(dt){
    this.t+=dt;var ph=(this.t%this.period)/this.period;
    // contraction (first ~28% of the cycle) then slow relaxation
    var sq=ph<.28?Math.sin(ph/.28*Math.PI/2):Math.pow(1-(ph-.28)/.72,1.6);
    if(ph<.28&&this.sq<sq){var up=-(sq-this.sq)*this.r*.09;this.vx+=Math.sin(this.tilt)*-up;this.vy+=Math.cos(this.tilt)*up}
    this.sq=sq;
    this.tilt+=(this.nz(this.t*.004)*.35-this.tilt)*.01*dt;
    this.vy+=.0035*dt;                                  // slow sink between pulses
    this.vx+=Math.sin(time*.002+this.r)*.0008*dt;       // drift with the current
    this.vx*=Math.pow(.985,dt);this.vy*=Math.pow(.985,dt);
    this.x+=this.vx*dt;this.y+=this.vy*dt;
    if(this.x<-60)this.x=W+60;if(this.x>W+60)this.x=-60;
    if(this.y<-this.r*6){this.y=H+this.r*2;this.reset()}if(this.y>H+this.r*8){this.y=-this.r*2;this.reset()}
    // tentacles: verlet ropes hanging from the rim
    var self=this,cos=Math.cos(this.tilt),sin=Math.sin(this.tilt),rw=this.r*(1-this.sq*.22);
    function rope(t,anchorK,yOff){var pts=t.pts,ax=(anchorK*2-1)*rw*.85,ay=yOff;
      pts[0].x=self.x+ax*cos-ay*sin;pts[0].y=self.y+ax*sin+ay*cos;
      for(var k=1;k<pts.length;k++){var q=pts[k],vx=(q.x-q.ox)*.94,vy=(q.y-q.oy)*.94;q.ox=q.x;q.oy=q.y;q.x+=vx+Math.sin(time*.03+k*.6+anchorK*5)*.04;q.y+=vy+.035*dt}
      for(var it=0;it<2;it++)for(k=1;k<pts.length;k++){var a=pts[k-1],b=pts[k],dx=b.x-a.x,dy=b.y-a.y,d=Math.hypot(dx,dy)||1,df=(d-t.seg)/d;b.x-=dx*df;b.y-=dy*df}}
    this.tent.forEach(function(t){rope(t,t.k,self.r*.2)});
    this.arms.forEach(function(t){rope(t,.25+t.k*.5,self.r*.1)});
  };
  Jelly.prototype.reset=function(){var self=this;this.tent.concat(this.arms).forEach(function(t){t.pts.forEach(function(q){q.x=q.ox=self.x;q.y=q.oy=self.y})})};
  Jelly.prototype.draw=function(){
    var al=this.alpha();if(al<=.01)return;
    var r=this.r,rw=r*(1-this.sq*.22),rh=r*(.8+this.sq*.25);
    ctx.globalAlpha=al*.35;var g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,r*2.4);g.addColorStop(0,this.c);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(this.x,this.y,r*2.4,0,TAU);ctx.fill();
    // tentacles
    ctx.globalAlpha=al*.55;ctx.strokeStyle=this.c;ctx.lineCap='round';
    this.tent.forEach(function(t){ctx.lineWidth=Math.max(.5,r*.035);ctx.beginPath();ctx.moveTo(t.pts[0].x,t.pts[0].y);
      for(var k=1;k<t.pts.length-1;k++)ctx.quadraticCurveTo(t.pts[k].x,t.pts[k].y,(t.pts[k].x+t.pts[k+1].x)/2,(t.pts[k].y+t.pts[k+1].y)/2);ctx.stroke()});
    ctx.globalAlpha=al*.6;
    this.arms.forEach(function(t){ctx.lineWidth=r*.14;ctx.beginPath();ctx.moveTo(t.pts[0].x,t.pts[0].y);
      for(var k=1;k<t.pts.length-1;k++)ctx.quadraticCurveTo(t.pts[k].x,t.pts[k].y,(t.pts[k].x+t.pts[k+1].x)/2,(t.pts[k].y+t.pts[k+1].y)/2);ctx.stroke()});
    // bell
    ctx.save();ctx.translate(this.x,this.y);ctx.rotate(this.tilt);
    ctx.beginPath();ctx.moveTo(-rw,r*.2);ctx.bezierCurveTo(-rw*1.02,-rh*1.05,rw*1.02,-rh*1.05,rw,r*.2);
    ctx.quadraticCurveTo(rw*.5,r*.32-this.sq*r*.06,0,r*.26);ctx.quadraticCurveTo(-rw*.5,r*.32-this.sq*r*.06,-rw,r*.2);ctx.closePath();
    var bg=ctx.createRadialGradient(-rw*.2,-rh*.5,r*.05,0,-rh*.2,r*1.2);bg.addColorStop(0,'rgba(255,255,255,.85)');bg.addColorStop(.35,this.c);bg.addColorStop(1,'rgba(143,124,255,.25)');
    ctx.globalAlpha=al*.85;ctx.fillStyle=bg;ctx.fill();
    ctx.globalAlpha=al*.5;ctx.strokeStyle='#fff';ctx.lineWidth=1;ctx.stroke();
    // inner lobes
    ctx.globalAlpha=al*.35;ctx.fillStyle='#fff';
    for(var i=-1;i<=1;i+=2){ctx.beginPath();ctx.ellipse(i*rw*.28,-rh*.25,rw*.18,rh*.22,i*.4,0,TAU);ctx.fill()}
    ctx.restore();ctx.globalAlpha=1;
  };

  /* ---------- manta ---------- */
  // A 3-D manta seen a little from below: wings flap up and down with a wave travelling out to the tips,
  // it banks into turns and alternates strokes with long glides. Back is dark, belly pale.
  function Manta(){
    this.s=small?.55:1;this.L=118*this.s;this.B=140*this.s;
    this.x=rnd(W*.2,W*.8);this.y=rnd(H*.35,H*.65);this.z=rnd(-ZR,0);
    this.yaw=Math.random()<.5?0:Math.PI;this.course=this.yaw;this.roll=0;this.pitch=0;
    this.v=.4;this.ph=0;this.amp=1;this.beat=true;this.modeT=rnd(200,400);this.nz=Noise();this.par=.15;
  }
  Manta.prototype.update=function(dt){
    // long strokes, then glides with the wings held out
    this.modeT-=dt;if(this.modeT<=0){this.beat=!this.beat;this.modeT=this.beat?rnd(260,520):rnd(160,300)}
    this.amp+=((this.beat?1:.12)-this.amp)*.01*dt;
    this.ph+=(.022+.012*this.amp)*dt;
    this.course+=this.nz(time*.0015)*.004*dt;
    this.course+=angDiff(this.course,Math.cos(this.course)>=0?0:Math.PI)*.004*dt;
    var dx=Math.cos(this.course),dz=Math.sin(this.course),m=this.B;
    if(this.x<-m*.5)dx+=1.5;if(this.x>W+m*.5)dx-=1.5;if(this.z>0)dz-=this.z/120;if(this.z<-ZR*1.2)dz+=.5;
    var want=Math.atan2(dz,dx),turn=clamp(angDiff(this.yaw,want),-.0045*dt,.0045*dt);
    this.yaw+=turn;this.roll+=(-clamp(angDiff(this.yaw,want),-.7,.7)*.7-this.roll)*.03*dt;   // bank into the turn
    var pT=this.y<H*.3?.12:this.y>H*.75?-.12:Math.sin(time*.004)*.05;this.pitch+=(pT-this.pitch)*.01*dt;
    // each down-stroke gives a little push
    var push=Math.max(0,Math.sin(this.ph))*this.amp;this.v+=(.28+push*.3-this.v)*.02*dt;
    var cp=Math.cos(this.pitch);
    this.x+=cp*Math.cos(this.yaw)*this.v*dt;this.z+=cp*Math.sin(this.yaw)*this.v*dt;this.y+=Math.sin(this.pitch)*this.v*dt-Math.cos(this.ph)*.06*this.amp*dt;
  };
  Manta.prototype.draw=function(){
    var al=clamp(depth*1.4-.3,0,.75);if(al<=.01)return;
    var self=this,L=this.L,B=this.B,A=B*.32*this.amp,cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cr=Math.cos(this.roll),sr=Math.sin(this.roll),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
    // local (forward, up, side) -> screen, viewed slightly from below
    function P(f,u,s){
      var u1=u*cr-s*sr,s1=u*sr+s*cr;                 // roll
      var f2=f*cp-u1*sp,u2=f*sp+u1*cp;               // pitch
      var x=self.x+f2*cy-s1*sy,z=self.z+f2*sy+s1*cy,y=self.y+u2;
      var q=proj(x,y+(z-self.z)*.28,z);return q;      // tilt: nearer points sit lower, so the belly shows
    }
    function wing(side){
      var pts=[],M=12,i,t,flap;
      for(i=0;i<=M;i++){t=i/M;flap=-A*Math.sin(self.ph-t*1.5)*Math.pow(t,1.35);
        pts.push(P(L*(.45-.62*Math.pow(t,1.35))-Math.abs(flap)*.12,flap,side*t*B))}
      for(i=M;i>=0;i--){t=i/M;flap=-A*Math.sin(self.ph-t*1.5-.25)*Math.pow(t,1.35);
        pts.push(P(L*(-.45+.28*Math.pow(t,1.8))-Math.abs(flap)*.12,flap,side*t*B))}
      return pts;
    }
    function area(pts){var a=0;for(var i=0;i<pts.length;i++){var p=pts[i],q=pts[(i+1)%pts.length];a+=p.x*q.y-q.x*p.y}return a/2}
    function path(pts){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath()}
    ctx.globalAlpha=al;
    // tail: thin whip with a slow wave
    ctx.strokeStyle='#5d67bf';ctx.lineWidth=2.2*this.s;ctx.lineCap='round';ctx.beginPath();
    for(var i=0;i<=10;i++){var t=i/10,q=P(-L*(.42+t*1.1),Math.sin(this.ph*1.2-t*3)*6*this.s*t,0);if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y)}ctx.stroke();
    // wings: back (dark) or belly (pale) depending on which face is toward us
    [-1,1].forEach(function(side){
      var w=wing(side),belly=area(w)*side*(Math.cos(self.yaw)>=0?1:-1)>0;
      path(w);
      var a=w[0],b=w[12];var g=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
      if(belly){g.addColorStop(0,'#eef0ff');g.addColorStop(.75,'#c9cdf2');g.addColorStop(1,'#3a3f86')}
      else{g.addColorStop(0,'#4b5aa8');g.addColorStop(.55,'#5d67bf');g.addColorStop(1,'#7a6fd6')}
      ctx.fillStyle=g;ctx.fill();
      ctx.strokeStyle='rgba(190,200,255,.45)';ctx.lineWidth=1.2;ctx.stroke();
    });
    // body ridge and head lobes (cephalic fins)
    var h0=P(L*.48,0,-B*.07),h1=P(L*.48,0,B*.07),hn=P(L*.5,0,0);
    ctx.fillStyle='#4b5aa8';
    [-1,1].forEach(function(sd){var r=P(L*.47,0,sd*B*.09),t1=P(L*.68,-6*self.s,sd*B*.11),t2=P(L*.66,4*self.s,sd*B*.06);
      ctx.beginPath();ctx.moveTo(r.x,r.y);ctx.quadraticCurveTo(t1.x,t1.y,t2.x,t2.y);ctx.lineTo(hn.x,hn.y);ctx.closePath();ctx.fill()});
    var c0=P(L*.45,0,0),c1=P(-L*.42,0,0);
    ctx.strokeStyle='rgba(60,70,150,.7)';ctx.lineWidth=6*this.s;ctx.beginPath();ctx.moveTo(c0.x,c0.y);ctx.lineTo(c1.x,c1.y);ctx.stroke();
    ctx.globalAlpha=1;
  };

  /* ---------- populate ---------- */
  var PAL={
    teal:{back:'#14506a',side:'#36b9b0',belly:'#d6fff7',fin:'rgba(63,214,198,.55)'},
    pink:{back:'#5b2f86',side:'#e77fbd',belly:'#ffe3f2',fin:'rgba(255,143,200,.5)'},
    gold:{back:'#6f5a12',side:'#e2c93d',belly:'#fff7c9',fin:'rgba(242,225,75,.5)'},
    blue:{back:'#22407f',side:'#5f9fe6',belly:'#e3efff',fin:'rgba(111,182,255,.45)'},
    violet:{back:'#2e2470',side:'#7d6ce8',belly:'#e8e3ff',fin:'rgba(143,124,255,.5)'}
  };
  var fish=[];
  function makeSchool(count,o){
    var arr=[],cx=Math.random()<.5?rnd(W*.06,W*.26):rnd(W*.74,W*.94),cy=o.y*H,cz=rnd(-ZR*.5,0),a=Math.random()<.5?0:Math.PI;
    for(var i=0;i<count;i++){var f=new Fish({len:o.len*rnd(.85,1.15),fat:.27,seg:9,v:o.v*rnd(.9,1.1),x:cx+rnd(-70,70),y:cy+rnd(-35,35),z:cz+rnd(-50,50),yaw:a+rnd(-.15,.15),col:o.col,layer:o.layer,par:o.par,detail:false});
      f.glow=o.glow;arr.push(f);fish.push(f)}
    arr.forEach(function(f){f.school=arr});
  }
  makeSchool(small?6:11,{len:small?16:21,v:1.05,y:.32,col:PAL.blue,layer:'far',par:.25});
  makeSchool(small?5:9,{len:small?15:19,v:.95,y:.7,col:PAL.violet,layer:'deep',par:.3,glow:true});
  [[PAL.teal,small?56:84,.95,'near',.55],[PAL.pink,small?48:68,.85,'near',.5],[PAL.gold,small?34:46,1.05,'far',.3]]
    .forEach(function(c,i){fish.push(new Fish({col:c[0],len:c[1],fat:.3,seg:13,v:c[2],layer:c[3],par:c[4],y:H*(.22+i*.24),z:c[3]==='near'?rnd(0,ZR):rnd(-ZR,0),detail:c[3]==='near'}))});
  var jellies=[new Jelly({x:W*.8,y:H*.3,r:small?14:22,c:'#ff8fc8',base:.25}),new Jelly({x:W*.12,y:H*.62,r:small?11:16,c:'#8f7cff',base:.05})];
  jellies.forEach(function(j){j.par=.35});
  var manta=new Manta();

  /* ---------- loop ---------- */
  var ptr={x:0,y:0,on:false},lastY=scrollY,last=performance.now(),raf=0,visible=!document.hidden;
  if(matchMedia('(pointer:fine)').matches){
    addEventListener('pointermove',function(e){ptr.x=e.clientX;ptr.y=e.clientY;ptr.on=true},{passive:true});
    document.addEventListener('pointerleave',function(){ptr.on=false});
  }
  function shift(o,s){o.y+=s;if(o.p)o.p.forEach(function(q){q.y+=s});if(o.tent)o.tent.concat(o.arms).forEach(function(t){t.pts.forEach(function(q){q.y+=s;q.oy+=s})})}
  function scrollShift(){
    var dy=scrollY-lastY;lastY=scrollY;if(!dy)return;
    // swimming down the page: the sea moves up past you
    fish.concat([manta],jellies).forEach(function(f){
      shift(f,-dy*f.par);
      if(f.y<-140)shift(f,H+280);else if(f.y>H+140)shift(f,-(H+280));
    });
    bubbles.forEach(function(b){b.y-=dy*.4});
    snow.forEach(function(s){s.y=((s.y-dy*.2/H)%1+1)%1});
  }
  function frame(now){
    var dt=Math.min(3,(now-last)/16.67);last=now;time+=dt;
    scrollShift();
    ctx.clearRect(0,0,W,H);
    drawSnow(dt);
    manta.update(dt);manta.draw();
    for(var i=0;i<fish.length;i++)fish[i].update(dt,ptr);
    // draw far to near (by depth in the slab); jellyfish sit in the middle
    fish.sort(function(a,b){return a.z-b.z});
    var mid=fish.findIndex(function(f){return f.z>0});if(mid<0)mid=fish.length;
    for(i=0;i<mid;i++)fish[i].draw();
    jellies.forEach(function(j){j.update(dt);j.draw()});
    for(i=mid;i<fish.length;i++)fish[i].draw();
    updateBubbles(dt);drawBubbles();
    raf=(visible&&!still)?requestAnimationFrame(frame):0;
  }
  function start(){if(!raf){last=performance.now();raf=requestAnimationFrame(frame)}}

  addEventListener('scroll',function(){readDepth();if(still)requestAnimationFrame(frame)},{passive:true});
  addEventListener('resize',function(){size();readDepth();if(still)requestAnimationFrame(frame)});
  document.addEventListener('visibilitychange',function(){visible=!document.hidden;oc.classList.toggle('paused',!visible);if(visible)start()});
  readDepth();
  if(still){for(var k=0;k<60;k++){time+=1;fish.forEach(function(f){f.update(1,ptr)});jellies.forEach(function(j){j.update(1)})}requestAnimationFrame(frame)}else start();
})();
