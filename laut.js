// Ocean layer — sunlit surface at the top of the page, glowing deep sea further down.
// Scroll position sets --depth (0..1); the gauge reads it as metres.
// Everything that moves is simulated on one canvas:
//  - fish: jointed spine led by the head, carangiform body wave (mostly in the rear third),
//    burst-and-coast swimming, smooth noise-driven steering, countershaded bodies, schooling (boids)
//  - jellyfish: bell contraction gives thrust, then a slow sink; verlet tentacles trail behind
//  - seeds: a few glowing Pandora tree seeds drifting slowly upward (replaced the bubbles)
//  - manta: luminous blue, seen from above, flapping wave, glowing ribs, spine and spiral ornaments
//  - marine snow: slow sinking specks, glowing plankton in the deep
//  - reef: glowing corals on both walls of the deep, anemones and sea grass swaying; surface caustics up top
(function(){
  var oc=document.getElementById('ocean');
  if(!oc)return;
  var small=innerWidth<700;
  var still=matchMedia('(prefers-reduced-motion: reduce)').matches;

  oc.innerHTML='<div class="water"></div><div class="water-deep"></div><div class="tint"></div><div class="sun"></div><div class="floor"></div><div class="rays"><i></i><i></i><i></i><i></i><i></i></div><canvas class="swim"></canvas><div class="gauge">Depth <b>0 m</b></div>';

  /* ---------- depth from scroll ---------- */
  var depth=0,gauge=oc.querySelector('.gauge b'),lastShown=-1;
  function readDepth(){
    var max=Math.max(1,document.documentElement.scrollHeight-innerHeight);
    depth=Math.min(1,Math.max(0,scrollY/max));
    if(Math.abs(depth-lastShown)>=.002){lastShown=depth;oc.style.setProperty('--depth',depth.toFixed(3));gauge.textContent=Math.round(depth*200)+' m'}
  }

  /* ---------- canvas ---------- */
  var cv=oc.querySelector('canvas.swim'),ctx=cv.getContext('2d'),W=0,H=0,dpr=1;
  function size(){dpr=Math.min(devicePixelRatio||1,1.5);W=innerWidth;H=innerHeight;cv.width=W*dpr;cv.height=H*dpr;cv.style.width=W+'px';cv.style.height=H+'px';ctx.setTransform(dpr,0,0,dpr,0,0);reefDirty=true}
  var reefDirty=true;
  size();

  var TAU=Math.PI*2,time=0;
  function rnd(a,b){return a+Math.random()*(b-a)}
  function clamp(v,a,b){return v<a?a:v>b?b:v}
  function angDiff(a,b){var d=(b-a)%TAU;if(d>Math.PI)d-=TAU;if(d<-Math.PI)d+=TAU;return d}
  // smooth 1-D noise from three detuned sines, roughly -1..1
  function Noise(){var a=rnd(.7,1.3),b=rnd(1.7,2.6),c=rnd(3.1,4.3),p=rnd(0,TAU),q=rnd(0,TAU),r=rnd(0,TAU);
    return function(t){return (Math.sin(t*a+p)+.55*Math.sin(t*b+q)+.25*Math.sin(t*c+r))/1.8}}

  /* ---------- seeds of the sacred tree ---------- */
  // A few glowing, jellyfish-like seeds (Pandora's atokirina') float slowly upward instead of bubbles:
  // soft halo, bright core, fine threads that sway and slowly turn. Calm, sparse, never in clusters.
  var seeds=[];
  function seed(y){return{x:rnd(0,W),y:y==null?rnd(0,H):y,r:rnd(5,9)*(small?.8:1),vy:-rnd(.04,.1),ph:rnd(0,TAU),spin:rnd(-.004,.004),rot:rnd(0,TAU),n:Math.round(rnd(11,15))}}
  for(var si2=0;si2<(small?5:9);si2++)seeds.push(seed());
  function updateBubbles(dt){
    for(var i=0;i<seeds.length;i++){var e=seeds[i];
      e.ph+=.01*dt;e.rot+=e.spin*dt;
      e.y+=e.vy*dt;e.x+=Math.sin(e.ph)*.12*dt+Math.sin(time*.003+e.y*.01)*.04*dt;
      if(e.y<-30)seeds[i]=seed(H+30);if(e.x<-30)e.x=W+30;if(e.x>W+30)e.x=-30}
  }
  function drawBubbles(){
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    for(var i=0;i<seeds.length;i++){var e=seeds[i],r=e.r,pulse=.75+.25*Math.sin(e.ph*2.3),al=.55*pulse;
      var g=ctx.createRadialGradient(e.x,e.y,0,e.x,e.y,r*3.2);
      g.addColorStop(0,'rgba(235,250,255,'+(al*.55).toFixed(3)+')');g.addColorStop(.35,'rgba(170,230,255,'+(al*.18).toFixed(3)+')');g.addColorStop(1,'rgba(170,230,255,0)');
      ctx.fillStyle=g;ctx.fillRect(e.x-r*3.2,e.y-r*3.2,r*6.4,r*6.4);
      // threads: a dandelion-like crown, drooping a little and swaying
      ctx.strokeStyle='rgba(225,248,255,'+(al*.7).toFixed(3)+')';ctx.lineWidth=.7;
      for(var t=0;t<e.n;t++){var a=e.rot+t/e.n*TAU,sw=Math.sin(e.ph*1.6+t)*.25,len=r*(1.3+.25*Math.sin(t*2.1)),
          ex=e.x+Math.cos(a+sw)*len,ey=e.y+Math.sin(a+sw)*len*.8+r*.35;
        ctx.beginPath();ctx.moveTo(e.x,e.y);ctx.quadraticCurveTo(e.x+Math.cos(a)*len*.55,e.y+Math.sin(a)*len*.45,ex,ey);ctx.stroke();
        ctx.fillStyle='rgba(240,252,255,'+(al*.8).toFixed(3)+')';ctx.beginPath();ctx.arc(ex,ey,.9,0,TAU);ctx.fill()}
      ctx.fillStyle='rgba(255,255,255,'+(.6+.3*pulse).toFixed(3)+')';ctx.beginPath();ctx.arc(e.x,e.y,r*.22,0,TAU);ctx.fill();
    }
    ctx.restore();
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
    ctx.save();ctx.globalCompositeOperation='lighter';
    ctx.globalAlpha=al*.5;var g=ctx.createRadialGradient(this.x,this.y,0,this.x,this.y,r*2.4);g.addColorStop(0,this.c);g.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=g;ctx.beginPath();ctx.arc(this.x,this.y,r*2.4,0,TAU);ctx.fill();
    // tentacles
    ctx.globalAlpha=al*.55;ctx.strokeStyle=this.c;ctx.lineCap='round';
    this.tent.forEach(function(t){ctx.lineWidth=Math.max(.5,r*.035);ctx.beginPath();ctx.moveTo(t.pts[0].x,t.pts[0].y);
      for(var k=1;k<t.pts.length-1;k++)ctx.quadraticCurveTo(t.pts[k].x,t.pts[k].y,(t.pts[k].x+t.pts[k+1].x)/2,(t.pts[k].y+t.pts[k+1].y)/2);ctx.stroke()});
    ctx.globalAlpha=al*.6;ctx.restore();ctx.globalAlpha=al*.6;ctx.strokeStyle=this.c;ctx.lineCap='round';
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
  // A luminous blue manta seen from a little above so both wings spread out: bright cyan core fading to deep blue tips,
  // horned head, glowing ribs and spine, and ornamental tendrils ending in spirals that pulse outward.
  // Wings flap with a wave travelling out to the tips; it banks into turns and alternates strokes with glides.
  var MANTA_EL_C=.62,MANTA_EL_S=.78;   // camera elevation: how much of the wingspan we see from above
  function Manta(){
    this.s=small?.55:1;this.L=130*this.s;this.B=150*this.s;
    this.x=rnd(W*.2,W*.8);this.y=rnd(H*.35,H*.65);this.z=rnd(-ZR,0);
    this.yaw=Math.random()<.5?0:Math.PI;this.course=this.yaw;this.roll=0;this.pitch=0;
    this.v=.4;this.ph=0;this.amp=1;this.beat=true;this.modeT=rnd(200,400);this.nz=Noise();this.par=.15;
    this.p=[];this.spark=0;   // sparks shed from the wingtips (named p so scrolling shifts them too)
    this.dots=[];for(var i=0;i<(small?16:30);i++)this.dots.push({t:rnd(.15,.92),c:rnd(.08,.9),sd:Math.random()<.5?-1:1,r:rnd(.6,1.2),ph:rnd(0,TAU)});
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
    // sparks drift up and fade
    for(var i=this.p.length-1;i>=0;i--){var q=this.p[i];q.a-=.006*dt;q.x+=q.vx*dt;q.y+=q.vy*dt;q.vx*=.985;if(q.a<=0)this.p.splice(i,1)}
  };
  // ornament curves in normalized wing space (f in units of L, s in units of B); each ends in a spiral
  var MANTA_ORN=[
    [[.22,.1],[.27,.22],[.23,.34],[.14,.42]],
    [[.08,.12],[.06,.26],[-.01,.38],[-.07,.48]],
    [[.31,.12],[.31,.3],[.25,.47],[.16,.59],[.07,.65]],
    [[-.12,.1],[-.17,.2],[-.24,.25]],
    [[.36,.05],[.42,.16],[.38,.24]]
  ];
  Manta.prototype.draw=function(){
    var al=clamp(depth*1.4-.3,0,.75);if(al<=.01)return;
    var self=this,L=this.L,B=this.B,s=this.s,A=B*.28*this.amp,cy=Math.cos(this.yaw),sy=Math.sin(this.yaw),cr=Math.cos(this.roll),sr=Math.sin(this.roll),cp=Math.cos(this.pitch),sp=Math.sin(this.pitch);
    // local (forward, up, side) -> screen; the camera looks down a little, so nearer points sit lower
    function P(f,u,sd){
      var u1=u*cr-sd*sr,s1=u*sr+sd*cr;               // roll
      var f2=f*cp-u1*sp,u2=f*sp+u1*cp;               // pitch
      var x=self.x+f2*cy-s1*sy,z=self.z+f2*sy+s1*cy;
      return proj(x,self.y+u2*MANTA_EL_C+(z-self.z)*MANTA_EL_S,z);
    }
    // planform along the span t (0 = midline, 1 = wingtip): leading edge bulges forward, trailing edge sweeps back to the tail
    function le(t){return L*(.44-.57*Math.pow(t,1.6))}
    function te(t){return L*(-.44+.38*t-.07*t*t)}
    function flap(t,lag){return t<.1?0:-A*Math.sin(self.ph-t*1.5-lag)*Math.pow((t-.1)/.9,1.4)}
    function pt(t,c,side){var f=le(t)*(1-c)+te(t)*c;return P(f,flap(t,c*.3),side*t*B)}   // c: 0 leading edge .. 1 trailing edge
    function Wp(fn,sn,side){return P(fn*L,flap(sn,.15),side*sn*B)}                        // a point on the wing surface
    function curve(pts){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);
      for(var i=1;i<pts.length-1;i++)ctx.quadraticCurveTo(pts[i].x,pts[i].y,(pts[i].x+pts[i+1].x)/2,(pts[i].y+pts[i+1].y)/2);
      var e=pts[pts.length-1];ctx.lineTo(e.x,e.y)}
    function glowLine(pts,w,rgb,a){curve(pts);ctx.strokeStyle='rgba('+rgb+','+(a*.25).toFixed(3)+')';ctx.lineWidth=w*3.2;ctx.stroke();
      ctx.strokeStyle='rgba('+rgb+','+a.toFixed(3)+')';ctx.lineWidth=w;ctx.stroke()}
    var M=16,T=[];for(var i=0;i<=M;i++)T.push(.1+.9*i/M);

    ctx.save();ctx.globalAlpha=al;ctx.lineCap='round';ctx.lineJoin='round';
    var hc=P(0,0,0),halo=ctx.createRadialGradient(hc.x,hc.y,0,hc.x,hc.y,B*1.25*hc.k);
    halo.addColorStop(0,'rgba(80,200,255,.22)');halo.addColorStop(1,'rgba(80,200,255,0)');
    ctx.fillStyle=halo;ctx.fillRect(hc.x-B*1.3*hc.k,hc.y-B*1.3*hc.k,B*2.6*hc.k,B*2.6*hc.k);

    // tail: long thin whip, bright at the root
    var tail=[];for(i=0;i<=16;i++){var tt=i/16;tail.push(P(-L*(.5+tt*1.5),Math.sin(this.ph*1.1-tt*3.2)*7*s*tt,Math.sin(this.ph*.6-tt*2.2)*9*s*tt))}
    var tg=ctx.createLinearGradient(tail[0].x,tail[0].y,tail[16].x,tail[16].y);
    tg.addColorStop(0,'rgba(90,200,255,.95)');tg.addColorStop(1,'rgba(40,110,220,.15)');
    curve(tail);ctx.strokeStyle=tg;ctx.lineWidth=2.6*s;ctx.stroke();

    // outline of the whole disc: head -> left wing -> pelvic lobe -> right wing -> head
    var out=[],h0=pt(T[0],0,-1),h1=pt(T[0],0,1);
    out.push(P(L*.43,0,-B*.04),P(L*.44,0,0),P(L*.43,0,B*.04));
    out.reverse();
    T.forEach(function(t){out.push(pt(t,0,-1))});
    for(i=M;i>=0;i--)out.push(pt(T[i],1,-1));
    out.push(P(-L*.46,0,-B*.075),P(-L*.53,0,-B*.05),P(-L*.555,0,0),P(-L*.53,0,B*.05),P(-L*.46,0,B*.075));   // rounded pelvic lobe
    T.forEach(function(t){out.push(pt(t,1,1))});
    for(i=M;i>=0;i--)out.push(pt(T[i],0,1));
    path(out);
    var bc=P(L*.08,0,0),g=ctx.createRadialGradient(bc.x,bc.y,0,bc.x,bc.y,B*1.05*bc.k);
    g.addColorStop(0,'rgba(125,225,255,.96)');g.addColorStop(.3,'rgba(60,170,245,.94)');g.addColorStop(.7,'rgba(28,105,215,.92)');g.addColorStop(1,'rgba(16,58,160,.9)');
    ctx.fillStyle=g;ctx.fill();

    // cephalic fins: two horns standing up from the head, curling slightly inward
    [-1,1].forEach(function(sd){
      var curl=.5+.5*Math.sin(self.ph*.5);
      var a=P(L*.42,0,sd*B*.06),b=P(L*.4,0,sd*B*.14),o1=P(L*.5,-2*s,sd*B*(.17-curl*.01)),tip=P(L*(.6-curl*.03),-3*s,sd*B*(.12-curl*.02)),i1=P(L*.5,-1*s,sd*B*.07);
      ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.quadraticCurveTo(o1.x,o1.y,tip.x,tip.y);ctx.quadraticCurveTo(i1.x,i1.y,a.x,a.y);ctx.closePath();
      var hg=ctx.createLinearGradient(b.x,b.y,tip.x,tip.y);hg.addColorStop(0,'rgba(60,170,245,.95)');hg.addColorStop(1,'rgba(150,235,255,.95)');
      ctx.fillStyle=hg;ctx.fill();
    });

    ctx.globalCompositeOperation='lighter';
    // wing strips that tilt up toward the surface catch more light; the flap wave reads as moving light
    [-1,1].forEach(function(side){
      for(var i=0;i<M;i++){
        var slope=(flap(T[i+1],.15)-flap(T[i],.15))/(B*(T[i+1]-T[i])),lit=clamp(-slope*1.1,-.5,.6);
        if(lit<=.02)continue;
        var a=pt(T[i],0,side),b=pt(T[i+1],0,side),c=pt(T[i+1],1,side),d=pt(T[i],1,side);
        ctx.fillStyle='rgba(150,220,255,'+(lit*.3).toFixed(3)+')';
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.lineTo(c.x,c.y);ctx.lineTo(d.x,d.y);ctx.closePath();ctx.fill();
      }
    });
    // glow down the spine, brightest behind the head
    var sg=P(L*.3,0,0),spg=ctx.createRadialGradient(sg.x,sg.y,0,sg.x,sg.y,L*.55*sg.k);
    spg.addColorStop(0,'rgba(200,245,255,.55)');spg.addColorStop(1,'rgba(120,220,255,0)');
    ctx.fillStyle=spg;ctx.fillRect(sg.x-L*.6*sg.k,sg.y-L*.6*sg.k,L*1.2*sg.k,L*1.2*sg.k);
    var spine=[];for(i=0;i<=10;i++)spine.push(P(L*(.42-i*.088),-1.5*s,0));
    var pulse=.75+.25*Math.sin(time*.04);
    glowLine(spine,1.8*s,'215,250,255',.85*pulse);

    // ribs either side of the spine behind the head
    [-1,1].forEach(function(sd){
      for(var r=0;r<5;r++){var f=.33-r*.055,w=.17-Math.abs(r-1.5)*.012;
        glowLine([Wp(f,.035,sd),Wp(f+.018,.1,sd),Wp(f-.005,w,sd)],1.6*s,'225,250,255',.75*pulse);}
    });

    // ornaments: tendrils that end in spirals, pulsing outward from the body
    [-1,1].forEach(function(sd){
      MANTA_ORN.forEach(function(o,k){
        var n=o.length,iso=B/L,pts=o.map(function(q){return[q[0],q[1]*iso]});   // iso space: both axes in units of L
        var e=pts[n-1],pv=pts[n-2],dx=e[0]-pv[0],dy=e[1]-pv[1],dl=Math.hypot(dx,dy),r0=.05-k*.004,dir=k%2?1:-1;
        var nx=-dy/dl*dir,ny=dx/dl*dir,cx=e[0]+nx*r0,cyy=e[1]+ny*r0,a0=Math.atan2(-ny,-nx);
        for(var j=1;j<=14;j++){var u=j/14,ang=a0-dir*u*Math.PI*1.7,rr=r0*(1-u*.75);pts.push([cx+Math.cos(ang)*rr,cyy+Math.sin(ang)*rr])}
        var sp=pts.map(function(q){return Wp(q[0],Math.max(.02,q[1]/iso),sd)});
        var a=.55+.4*Math.pow(.5+.5*Math.sin(time*.05-k*1.1),2);
        glowLine(sp,1.25*s,'200,245,255',a);
        glowDot(sp[sp.length-1],1.4*s,'230,252,255',a);
      });
      // teardrop loops down the middle of the body
      glowLine([Wp(.02,.025,sd),Wp(-.08,.085,sd),Wp(-.2,.08,sd),Wp(-.3,.04,sd),Wp(-.38,.012,sd)],1.3*s,'200,245,255',.7*pulse);
    });

    // eyes on the sides of the head
    [-1,1].forEach(function(sd){glowDot(P(L*.4,-1,sd*B*.15),1.5*s,'230,252,255',.9)});
    // fine sparkles inside the body
    this.dots.forEach(function(d){var tw=.5+.5*Math.sin(time*.07+d.ph);if(tw<.3)return;glowDot(pt(d.t,d.c,d.sd),d.r*s,'220,250,255',tw*.7)});

    // soft rim
    ctx.globalCompositeOperation='source-over';
    path(out);ctx.strokeStyle='rgba(170,235,255,.35)';ctx.lineWidth=1.2*s;ctx.stroke();

    // sparks drifting off the wingtips on the down-stroke
    this.spark+=Math.max(0,Math.sin(this.ph))*this.amp;
    if(this.spark>4&&this.p.length<(small?16:32)){this.spark=0;
      [-1,1].forEach(function(sd){var q=pt(1,.5,sd);self.p.push({x:q.x,y:q.y,vx:-cy*rnd(.1,.3),vy:-rnd(.05,.18),a:rnd(.5,.9),r:rnd(.8,1.6)*s})})}
    ctx.globalCompositeOperation='lighter';
    this.p.forEach(function(q){glowDot(q,q.r,'120,215,255',q.a*.7)});
    ctx.restore();
  };
  function path(pts){ctx.beginPath();ctx.moveTo(pts[0].x,pts[0].y);for(var i=1;i<pts.length;i++)ctx.lineTo(pts[i].x,pts[i].y);ctx.closePath()}
  function glowDot(q,r,rgb,a){
    var g=ctx.createRadialGradient(q.x,q.y,0,q.x,q.y,r*4);
    g.addColorStop(0,'rgba('+rgb+','+a.toFixed(3)+')');g.addColorStop(.25,'rgba('+rgb+','+(a*.45).toFixed(3)+')');g.addColorStop(1,'rgba('+rgb+',0)');
    ctx.fillStyle=g;ctx.fillRect(q.x-r*4,q.y-r*4,r*8,r*8);
  }

  /* ---------- surface shimmer ---------- */
  // bright, slowly shifting lines of light just under the surface (caustics)
  function drawSurface(){
    var al=clamp(.9-depth*3,0,.9);if(al<=.01)return;
    ctx.save();ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    for(var i=0;i<7;i++){
      var y0=8+i*13,amp=4+i*1.4,k=.006+i*.0013,sp=time*(.012+i*.003);
      ctx.strokeStyle='rgba(190,250,255,'+(al*(.32-i*.035)).toFixed(3)+')';ctx.lineWidth=2.2-i*.22;ctx.beginPath();
      for(var x=-20;x<=W+20;x+=18){var y=y0+Math.sin(x*k+sp+i)*amp+Math.sin(x*k*2.3-sp*1.4)*amp*.5;x>-20?ctx.lineTo(x,y):ctx.moveTo(x,y)}
      ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- reef ---------- */
  // A bioluminescent reef along the bottom of the deep: walls on both sides, low in the middle so the floor shows.
  // The rock and corals are painted once to an offscreen canvas; anemones and sea grass sway live in front.
  var reefC=document.createElement('canvas'),reefX=reefC.getContext('2d'),reefH=0,reefTop=[],sway=[];
  var CORAL={violet:'181,108,255',cyan:'69,224,255',green:'70,255,170',pink:'255,123,213',gold:'255,200,110'};
  function reefLine(x){   // height of the reef (0..1 of reefH) at screen x
    var u=x/W,wall=Math.max(Math.pow(Math.max(0,1-u/.3),1.6),Math.pow(Math.max(0,(u-.7)/.3),1.6)),base=.2+.05*Math.sin(u*17)+.04*Math.sin(u*41);
    return clamp(Math.max(base,wall*(.9+.06*Math.sin(u*29))),.12,.96);
  }
  function glowStroke(c,rgb,w,a){c.strokeStyle='rgba('+rgb+','+(a*.22).toFixed(3)+')';c.lineWidth=w*4;c.stroke();c.strokeStyle='rgba('+rgb+','+a.toFixed(3)+')';c.lineWidth=w;c.stroke()}
  function branch(c,x,y,ang,len,w,rgb,d){
    if(d<=0||len<3)return;
    var x2=x+Math.cos(ang)*len,y2=y+Math.sin(ang)*len;
    c.beginPath();c.moveTo(x,y);c.quadraticCurveTo(x+Math.cos(ang+.3)*len*.5,y+Math.sin(ang+.3)*len*.5,x2,y2);glowStroke(c,rgb,w,.85);
    if(d===1){c.fillStyle='rgba(255,255,255,.8)';c.beginPath();c.arc(x2,y2,w*.7,0,TAU);c.fill()}
    var n=d>2?2:rnd(1,3)|0;for(var i=0;i<n;i++)branch(c,x2,y2,ang+rnd(-.65,.65),len*rnd(.62,.8),w*.75,rgb,d-1);
  }
  function fan(c,x,y,r,rgb){
    for(var i=0;i<22;i++){var a=-Math.PI*(.12+.76*i/21),l=r*rnd(.75,1);c.beginPath();c.moveTo(x,y);
      c.quadraticCurveTo(x+Math.cos(a+.2)*l*.5,y+Math.sin(a+.2)*l*.5,x+Math.cos(a)*l,y+Math.sin(a)*l);glowStroke(c,rgb,.8,.6)}
    for(var j=1;j<4;j++){c.beginPath();c.arc(x,y,r*j/4,-Math.PI*.9,-Math.PI*.1);glowStroke(c,rgb,.6,.35)}
  }
  function brain(c,x,y,r,rgb){
    var g=c.createRadialGradient(x,y-r*.3,0,x,y,r*1.6);g.addColorStop(0,'rgba('+rgb+',.95)');g.addColorStop(.6,'rgba('+rgb+',.4)');g.addColorStop(1,'rgba('+rgb+',0)');
    c.fillStyle=g;c.beginPath();c.ellipse(x,y,r*1.6,r*1.2,0,Math.PI,0);c.fill();
    c.fillStyle='rgba(10,40,70,.55)';c.beginPath();c.ellipse(x,y,r,r*.75,0,Math.PI,0);c.fill();
    for(var j=1;j<=4;j++){c.beginPath();c.ellipse(x,y,r*j/4,r*.75*j/4,0,Math.PI,0);glowStroke(c,rgb,1,.8)}
  }
  function tubes(c,x,y,r,rgb){
    for(var i=0;i<6;i++){var tx=x+(i-2.5)*r*.45,th=r*rnd(.8,1.8);c.beginPath();c.moveTo(tx,y);c.lineTo(tx+rnd(-3,3),y-th);c.lineCap='round';glowStroke(c,rgb,r*.28,.7);
      c.fillStyle='rgba(255,255,255,.7)';c.beginPath();c.arc(tx,y-th,r*.12,0,TAU);c.fill()}
  }
  function buildReef(){
    reefDirty=false;reefH=Math.round(Math.min(H*.5,small?260:420));
    reefC.width=Math.round(W*dpr);reefC.height=Math.round(reefH*dpr);
    var c=reefX;c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,W,reefH);c.lineCap='round';
    reefTop=[];for(var x=0;x<=W;x+=8)reefTop.push(reefH*(1-reefLine(x)));
    // rock: two layers, the far one paler
    [[.92,'rgba(40,110,170,.5)',14],[1,'rgba(12,44,92,.95)',0]].forEach(function(L){
      c.beginPath();c.moveTo(0,reefH);
      for(var i=0;i<reefTop.length;i++){var x=i*8,y=reefTop[i]+(1-L[0])*reefH*.6-L[2]+Math.sin(i*1.7)*4;c.lineTo(x,y)}
      c.lineTo(W,reefH);c.closePath();
      var g=c.createLinearGradient(0,0,0,reefH);g.addColorStop(0,L[1]);g.addColorStop(1,'rgba(6,26,64,.98)');c.fillStyle=g;c.fill();
    });
    // pale sand in the open middle
    var sg=c.createRadialGradient(W/2,reefH,0,W/2,reefH,W*.35);sg.addColorStop(0,'rgba(150,220,255,.45)');sg.addColorStop(1,'rgba(150,220,255,0)');
    c.fillStyle=sg;c.fillRect(0,0,W,reefH);
    // corals on the rock surface
    c.globalCompositeOperation='lighter';
    var step=small?34:42,sc=small?.6:1;
    for(var x=10;x<W;x+=step*rnd(.6,1.3)){
      var y=reefH*(1-reefLine(x))+6,pick=Math.random(),ks=Object.keys(CORAL),rgb=CORAL[ks[(Math.random()*ks.length)|0]];
      if(pick<.34)branch(c,x,y,-Math.PI/2+rnd(-.3,.3),rnd(22,40)*sc,3*sc,Math.random()<.5?CORAL.violet:CORAL.cyan,5);
      else if(pick<.52)fan(c,x,y,rnd(26,44)*sc,Math.random()<.6?CORAL.cyan:CORAL.violet);
      else if(pick<.7)brain(c,x,y,rnd(9,16)*sc,CORAL.green);
      else if(pick<.85)tubes(c,x,y,rnd(8,13)*sc,Math.random()<.5?CORAL.pink:CORAL.gold);
      // polyps: tiny lights scattered on the rock
      for(var k=0;k<5;k++){var px=x+rnd(-20,20),py=y+rnd(4,reefH*.25);c.fillStyle='rgba('+rgb+','+rnd(.4,.9).toFixed(2)+')';c.beginPath();c.arc(px,py,rnd(.8,1.8),0,TAU);c.fill()}
    }
    c.globalCompositeOperation='source-over';
    // swaying anemones and sea grass, drawn live
    sway=[];var n=small?7:14;
    for(var i=0;i<n;i++){var sx=rnd(0,W),kind=Math.random()<.45?'grass':'anem';
      sway.push({x:sx,y:reefH*(1-reefLine(sx))+8,kind:kind,h:(kind==='grass'?rnd(40,80):rnd(14,22))*sc,ph:rnd(0,TAU),rgb:kind==='grass'?CORAL.green:(Math.random()<.6?CORAL.pink:CORAL.violet)})}
  }
  function drawReef(){
    var show=clamp((depth-.45)/.45,0,1);if(show<=0)return;
    if(reefDirty)buildReef();
    var top=H-reefH*(.25+.75*show)+ (1-show)*40;
    ctx.save();ctx.globalAlpha=.25+.75*show;
    ctx.drawImage(reefC,0,top,W,reefH);
    // live glow pulse and swaying life
    ctx.globalCompositeOperation='lighter';ctx.lineCap='round';
    sway.forEach(function(o){
      var bx=o.x,by=top+o.y;
      if(o.kind==='grass'){
        for(var b=0;b<3;b++){var off=(b-1)*5,bend=Math.sin(time*.02+o.ph+b)*o.h*.25;ctx.beginPath();ctx.moveTo(bx+off,by);
          ctx.quadraticCurveTo(bx+off+bend*.4,by-o.h*.55,bx+off+bend,by-o.h*(.85+b*.08));
          ctx.strokeStyle='rgba('+o.rgb+',.18)';ctx.lineWidth=6;ctx.stroke();ctx.strokeStyle='rgba('+o.rgb+',.6)';ctx.lineWidth=1.6;ctx.stroke()}
      }else{
        for(var t=0;t<9;t++){var a=-Math.PI/2+(t-4)*.22,wv=Math.sin(time*.035+o.ph+t*.7)*.25,ex=bx+Math.cos(a+wv)*o.h,ey=by+Math.sin(a+wv)*o.h;
          ctx.beginPath();ctx.moveTo(bx,by);ctx.quadraticCurveTo(bx+Math.cos(a)*o.h*.5,by+Math.sin(a)*o.h*.5,ex,ey);
          ctx.strokeStyle='rgba('+o.rgb+',.2)';ctx.lineWidth=5;ctx.stroke();ctx.strokeStyle='rgba('+o.rgb+',.75)';ctx.lineWidth=1.8;ctx.stroke();
          ctx.fillStyle='rgba(255,240,255,.85)';ctx.beginPath();ctx.arc(ex,ey,1.4,0,TAU);ctx.fill()}
      }
    });
    ctx.restore();
  }

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
  makeSchool(small?5:8,{len:small?11:14,v:1.1,y:.55,col:PAL.gold,layer:'deep',par:.28});
  [[PAL.teal,small?56:84,.95,'near',.55],[PAL.pink,small?48:68,.85,'near',.5],[PAL.gold,small?34:46,1.05,'far',.3]]
    .forEach(function(c,i){fish.push(new Fish({col:c[0],len:c[1],fat:.3,seg:13,v:c[2],layer:c[3],par:c[4],y:H*(.22+i*.24),z:c[3]==='near'?rnd(0,ZR):rnd(-ZR,0),detail:c[3]==='near'}))});
  var jellies=[new Jelly({x:W*.8,y:H*.3,r:small?14:22,c:'#ff8fc8',base:.25}),new Jelly({x:W*.12,y:H*.62,r:small?11:16,c:'#b98cff',base:.05}),new Jelly({x:W*.55,y:H*.8,r:small?9:13,c:'#7fe9ff',base:.1})];
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
    seeds.forEach(function(e){e.y-=dy*.25;if(e.y<-30)e.y+=H+60;else if(e.y>H+30)e.y-=H+60});
    snow.forEach(function(s){s.y=((s.y-dy*.2/H)%1+1)%1});
  }
  function frame(now){
    var dt=Math.min(3,(now-last)/16.67);last=now;time+=dt;
    scrollShift();
    ctx.clearRect(0,0,W,H);
    drawSurface();
    drawSnow(dt);
    drawReef();
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
