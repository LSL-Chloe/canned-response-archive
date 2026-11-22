/* Liquid Glass for Response Archive — drop-in. Add before </body>:  <script defer src="/liquid-glass.js"></script>
   Layout/DOM untouched. Visual layer only. */
(()=>{
if(window.__LG)return;window.__LG=1;
const D=document,R=D.documentElement,M=q=>matchMedia(q).matches;
const mem=navigator.deviceMemory||4,cores=navigator.hardwareConcurrency||4;
let tier=mem<=2||cores<=4?0:mem<=4||cores<=6?1:2;           // 0 low-end · 1 mid · 2 high
const calm=M('(prefers-reduced-motion:reduce)');
if(M('(prefers-reduced-transparency:reduce)')||navigator.connection?.saveData)tier=0;
const reducedTransparency=M('(prefers-reduced-transparency:reduce)');
const refract=!reducedTransparency&&typeof CSS!=='undefined'&&CSS.supports('backdrop-filter','url(#a)');
R.dataset.lg=tier;
// Exactly two visible backgrounds: the original shader and the lined CSS fallback.
// Renderer availability never changes the React controls or their animations.
const visualMode=(env,mode,renderer)=>{
 R.dataset.visualMode=mode;
 // CSS can identify the *actual* lined fallback rather than styling the
 // pending first GPU frame or the original WebGL controls.
 R.dataset.ambientMode=renderer;
 env.dataset.visualMode=mode;
 env.dataset.ambientMode=renderer;
};

/* ───────── MATERIAL (CSS) ───────── */
const css=`
:root{--spring:linear(0,.18,.55,.86,1.04,1.1,1.08,1.04,1.01,.995,.998,1);--la:315deg}
:is(.archive-app,.auth-experience)[data-theme=light]{--lg-tint:rgba(255,255,255,.14);--lg-r1:rgba(255,255,255,.98);--lg-r2:rgba(255,255,255,.38);--lg-sh:rgba(28,40,58,.22);--lg-drop:rgba(40,56,80,.2);--lg-sat:1.55;--lg-br:1.05}
:is(.archive-app,.auth-experience)[data-theme=dark]{--lg-tint:rgba(255,255,255,.05);--lg-r1:rgba(255,255,255,.66);--lg-r2:rgba(255,255,255,.13);--lg-sh:rgba(0,0,0,.55);--lg-drop:rgba(0,0,0,.45);--lg-sat:1.4;--lg-br:1.22}
:where([data-lgx]){position:relative}
[data-liquid-glass],[data-lgx]{background:var(--lg-tint)!important;border-color:transparent!important;
 -webkit-backdrop-filter:var(--lg-bf,saturate(var(--lg-sat)) brightness(var(--lg-br)))!important;
 backdrop-filter:var(--lg-bf,saturate(var(--lg-sat)) brightness(var(--lg-br)))!important;
 box-shadow:inset 0 -9px 16px -11px var(--lg-sh),inset 0 1px 0 var(--lg-r2),0 10px 26px -10px var(--lg-drop)!important}
[data-liquid-glass]::after,[data-lgx]::after{content:"";position:absolute;inset:0;border-radius:inherit;pointer-events:none;padding:1.25px;z-index:3;
 background:conic-gradient(from var(--la),var(--lg-r1),transparent 24%,var(--lg-r2) 50%,transparent 74%,var(--lg-r1));
 -webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude}
[data-liquid-glass]>[data-lg-layer]:not(svg),.liquid-underlay-fill{display:none!important}
[data-lgx=flat]::after{display:none}
.archive-sidebar[data-lgx]{box-shadow:inset -1px 0 0 var(--lg-r2),6px 0 18px -17px var(--lg-drop)!important}
.archive-topbar[data-lgx]{box-shadow:inset 0 -1px 0 var(--lg-r2),0 8px 20px -18px var(--lg-drop)!important}
.archive-composer,.archive-card,.archive-response-list,.auth-card{border-color:transparent!important;box-shadow:0 16px 36px -14px var(--lg-drop)!important}
.archive-topbar::before{content:"";position:absolute;inset:0 0 -26px;z-index:-1;pointer-events:none;background:linear-gradient(var(--a-bg),transparent);opacity:0}
@supports(animation-timeline:scroll()){.archive-topbar::before{animation:lgE linear both;animation-timeline:scroll(root);animation-range:0 90px}}
@keyframes lgE{to{opacity:.8}}
/* fluid spring motion (compositor-only transforms) */
.archive-nav-selection,.archive-tabs-lens,.auth-tabs-lens,.archive-visibility-lens{transition:transform .62s var(--spring),opacity .15s!important}
.liquid-theme-switch .liquid-switch-thumb{transition:transform .58s var(--spring),scale .3s var(--spring)!important}
.liquid-theme-switch:active .liquid-switch-thumb{scale:1.3 1.14!important}
.liquid-action,.archive-button,.archive-sign-in-link{transition:transform .4s var(--spring)!important}
.liquid-action:active,.archive-button:active,.archive-sign-in-link:active{transform:scale(.95)!important}
.archive-sidebar{transition-timing-function:cubic-bezier(.16,1,.3,1)!important;contain:layout style}
.archive-suggestion-list,.archive-avatar-gallery{overscroll-behavior:contain;-webkit-overflow-scrolling:touch}
.lg-gl>.optical-weave,.lg-gl>.optical-caustic{display:none}
:is(.archive-app,.auth-experience)[data-theme=light]{--lg-trk:rgba(255,255,255,.34);--lg-ts:rgba(40,55,75,.2)}
:is(.archive-app,.auth-experience)[data-theme=dark]{--lg-trk:rgba(0,0,0,.28);--lg-ts:rgba(0,0,0,.55)}
/* bars/containers must NOT own a backdrop-filter, or the lenses inside them can't see the background */
[data-lgx=flat],[data-lgx=nb]{-webkit-backdrop-filter:none!important;backdrop-filter:none!important}
[data-lgx=flat]{background:color-mix(in srgb,var(--a-surface) 28%,transparent)!important}
[data-lgx=nb]{background:color-mix(in srgb,var(--a-surface) 55%,transparent)!important}
.archive-nav[data-lgx],.archive-tabs[data-lgx],.archive-visibility-options[data-lgx],.archive-transfer-scope[data-lgx]{background:var(--lg-trk)!important;-webkit-backdrop-filter:none!important;backdrop-filter:none!important;box-shadow:inset 0 2px 7px var(--lg-ts),inset 0 -1px 0 var(--lg-r2)!important}
.archive-sidebar{border-right-color:transparent!important}
.archive-app button,.liquid-action,.archive-sign-in-link{-webkit-tap-highlight-color:transparent;touch-action:manipulation}
.liquid-action:hover,.archive-button:hover,.archive-sign-in-link:hover{transform:translateY(-1px) scale(1.03)!important}
/* Keep original bevels, outlines and spring transitions on every hardware
   tier. The tier adjusts backdrop resolution only, never control styling. */
/* Color changes follow the existing .58s sliding theme thumb, without replacing
   its spring animation or delaying React state changes. */
.archive-app[data-theme],.auth-experience[data-theme]{transition:color .58s ease,--a-bg .58s ease,--caustic .58s ease,--caustic-edge .58s ease,--ambient-blue .58s ease,--ambient-violet .58s ease,--ambient-rose .58s ease}
.archive-app>.optical-environment,.auth-experience>.optical-environment{transition:background-color .58s ease}
.archive-app .archive-sidebar{transition:width .27s cubic-bezier(.16,1,.3,1),flex-basis .27s cubic-bezier(.16,1,.3,1),padding .27s cubic-bezier(.16,1,.3,1),background-color .58s ease,border-color .58s ease}
.archive-app .archive-topbar{transition:background-color .58s ease,color .58s ease,border-color .58s ease}
.archive-app .archive-nav button{transition:color .58s ease}
.archive-app .archive-search-intro p:last-child,.archive-app .archive-composer-hint,.archive-app .archive-composer textarea,.archive-app .archive-composer textarea::placeholder,.archive-app .archive-composer kbd{transition:color .58s ease}
.auth-experience .auth-form-header p,.auth-experience .auth-field-label{transition:color .58s ease}
@media(prefers-reduced-motion:reduce){.archive-app[data-theme],.auth-experience[data-theme]{transition:none!important}}
`;
const st=D.createElement('style');st.textContent=css;D.head.append(st);

/* ───────── REFRACTION MAPS (SVG displacement, per element, cached) ─────────
   Convex-squircle bezel → outward-pointing vectors, strongest at the rim, 0 in the centre. */
const NS='http://www.w3.org/2000/svg',svg=D.createElementNS(NS,'svg');
svg.setAttribute('width',0);svg.setAttribute('height',0);svg.style.cssText='position:absolute;pointer-events:none';
const defs=D.createElementNS(NS,'defs');svg.append(defs);D.body.append(svg);
const maps=new Map();let uid=0;
function mapURL(w,h,r,b){
 const k=[w,h,r,b].join(),hit=maps.get(k);if(hit)return hit;
 const s=Math.max(1,Math.sqrt(w*h/30000)),cw=Math.max(2,Math.round(w/s)),ch=Math.max(2,Math.round(h/s));
 const c=D.createElement('canvas');c.width=cw;c.height=ch;
 let x=null;try{x=c.getContext('2d')}catch{return null}
 if(!x)return null;
 const im=x.createImageData(cw,ch),a=im.data;
 const hw=cw/2,hh=ch/2,rr=Math.min(r/s,hw,hh),bb=Math.max(1,Math.min(b/s,hw,hh));
 for(let j=0;j<ch;j++)for(let i=0;i<cw;i++){
  const px=i+.5-hw,py=j+.5-hh,qx=Math.abs(px)-(hw-rr),qy=Math.abs(py)-(hh-rr),ox=Math.max(qx,0),oy=Math.max(qy,0),ol=Math.hypot(ox,oy);
  const depth=-(ol+Math.min(Math.max(qx,qy),0)-rr),sx=px<0?-1:1,sy=py<0?-1:1;
  let nx,ny;if(ol>0){nx=sx*ox/ol;ny=sy*oy/ol}else if(qx>qy){nx=sx;ny=0}else{nx=0;ny=sy}
  const t=Math.min(1,Math.max(0,depth/bb)),m=t>=1?0:(1-t)*(1-t),o=(j*cw+i)*4;
  a[o]=128+127*nx*m;a[o+1]=128+127*ny*m;a[o+2]=128;a[o+3]=255;
 }
 x.putImageData(im,0,0);const u=c.toDataURL();
 if(maps.size>60)maps.delete(maps.keys().next().value);maps.set(k,u);return u;
}
function apply(el){
 if(!refract||!el.isConnected)return; // try original lens on small controls even on low-memory devices
 const w=el.offsetWidth,h=el.offsetHeight;if(!w||!h)return;
 const lens=Math.min(w,h)<=80;
 // Try the original displacement lens on all devices that support it.
 // A lens failure degrades refraction only, never the control's appearance.
 const r=Math.min(parseFloat(getComputedStyle(el).borderTopLeftRadius)||14,w/2,h/2);
 const id=el._lgid||(el._lgid='lgf'+ ++uid);let f=D.getElementById(id);
 if(!f){f=D.createElementNS(NS,'filter');f.id=id;f.setAttribute('color-interpolation-filters','sRGB');f.setAttribute('filterUnits','userSpaceOnUse');f.setAttribute('primitiveUnits','userSpaceOnUse');
  f.innerHTML='<feImage preserveAspectRatio="none" result="m"/><feDisplacementMap in="SourceGraphic" in2="m" xChannelSelector="R" yChannelSelector="G"/>';defs.append(f)}
 f.setAttribute('x',0);f.setAttribute('y',0);f.setAttribute('width',w);f.setAttribute('height',h);
 const im=f.firstChild;im.setAttribute('x',0);im.setAttribute('y',0);im.setAttribute('width',w);im.setAttribute('height',h);
 const texture=mapURL(w,h,r,lens?Math.min(18,h*.45):24);
 if(!texture){el.style.removeProperty('--lg-bf');return}
 im.setAttribute('href',texture);
 f.lastChild.setAttribute('scale',lens?Math.min(42,h*.85):15);
 el.style.setProperty('--lg-bf',`url(#${id}) saturate(var(--lg-sat)) brightness(var(--lg-br))`);
}
const ro=typeof ResizeObserver==='function'
 ?new ResizeObserver(es=>es.forEach(e=>{
  const t=e.target;clearTimeout(t._lt);
  t._lt=setTimeout(()=>{try{apply(t)}catch{t.style.removeProperty('--lg-bf')}},t._lg2?140:0);
  t._lg2=1;
 }))
 :{observe(t){requestAnimationFrame(()=>{try{apply(t)}catch{t.style.removeProperty('--lg-bf')}})}};

/* ───────── WIRING (React-safe: attributes only, re-scanned on DOM change) ───────── */
const GROUPS=[
 ['.archive-sidebar,.archive-topbar','flat'],
 ['.archive-nav,.archive-tabs,.archive-visibility-options,.archive-transfer-scope','css'],
 ['.archive-dialog,.archive-selection-toolbar,.archive-team-table-wrap,.archive-suggestion-popover','nb'],
 ['.archive-sign-in-link,.archive-account-button,.archive-button:not(.liquid-action-button)','css'],
 ['.archive-account-menu,.archive-message,.archive-tabs-lens,.auth-tabs-lens,.archive-visibility-lens,.otp-core-lens','']];
let G=null,q=0,bT=0,webglUnavailable=false,contextLossCount=0;
const failedGpuKinds=new Set();
let gpuRetryAt=0;
const busy=(ms=480)=>{R.dataset.busy='';clearTimeout(bT);bT=setTimeout(()=>delete R.dataset.busy,ms)};
addEventListener('scroll',()=>busy(160),{passive:true,capture:true});
function scan(){
 GROUPS.forEach(([s,v])=>D.querySelectorAll(s).forEach(e=>e.hasAttribute('data-lgx')||e.setAttribute('data-lgx',v)));
 D.querySelectorAll('[data-liquid-glass],[data-lgx=""]').forEach(e=>{if(!e._lg){e._lg=1;ro.observe(e)}});
 const app=D.querySelector('.archive-app');if(app&&!app._lgo){app._lgo=1;new MutationObserver(()=>busy()).observe(app,{attributes:true,attributeFilter:['class']})}
 const env=D.querySelector('.optical-environment');
 // React can replace the page and its backdrop while navigating. Dispose old
 // listeners and GPU contexts before wiring the new background.
 if(G&&(!env||G._env!==env)){
  G._stop();G=null;
 }
 if(!env)return;
 // Show the original-colored field while a GPU frame is being validated.
 // If the script cannot load, CSS independently shows the lined fallback.
 if(!env.dataset.visualMode)visualMode(env,'fallback','pending');
 if(!G){
  if(!webglUnavailable&&performance.now()>=gpuRetryAt)G=bg(env);
  if(!G)visualMode(env,'fallback','lines');
  // A WebGL canvas replaces the pending CSS only after a successful frame.
 }else if(G._ready&&!G.isConnected){
  // React may replace the backdrop's children during a page transition.
  env.prepend(G);env.classList.add('lg-gl');
 }
}
new MutationObserver(()=>{cancelAnimationFrame(q);q=requestAnimationFrame(scan)}).observe(D.body,{childList:true,subtree:true});

/* ───────── REACTIVE 3D BACKGROUND (WebGL2, one fullscreen triangle) ───────── */
const VS='#version 300 es\nvoid main(){vec2 p=vec2((gl_VertexID<<1)&2,gl_VertexID&2);gl_Position=vec4(p*2.-1.,0,1);}';
const FS=`#version 300 es
precision highp float;uniform vec2 uR,uM;uniform float uT,uD;uniform vec4 uK[6];out vec4 o;
void main(){
 vec2 uv=(gl_FragCoord.xy-.5*uR)/uR.y;
 float rip=0.;vec2 wv=vec2(0.);
 for(int i=0;i<6;i++){vec4 k=uK[i];float age=uT-k.z;if(k.w>0.&&age<3.5){vec2 d=uv-k.xy;float r=length(d),e=(r-age*.55)*7.,w=exp(-age*1.3)*exp(-e*e);rip+=w;wv+=normalize(d+1e-4)*w*.05;}}
 vec2 p=uv+wv;float f=0.;vec2 gr=vec2(0.);
 for(int i=0;i<6;i++){
  float fi=float(i),ph=fi*1.7;
  vec2 c=vec2(sin(uT*.17+ph*1.3)*.75+cos(uT*.11+ph)*.2,cos(uT*.13+ph*.8)*.42+sin(uT*.19+ph)*.15);
  c+=uM*(.08+fi*.05);if(i==0)c=mix(c,uM,.65);
  float r=.2+.05*sin(uT*.4+ph);vec2 d=p-c;float q=dot(d,d)+.004,s=r*r/q;f+=s;gr+=-2.*s*d/q;
 }
 float h=smoothstep(.7,1.9,f);vec3 n=normalize(vec3(-gr*.045,1.));
 vec3 L=normalize(vec3(uM.x-.4,uM.y+.6,.9));
 float dif=clamp(dot(n,L),0.,1.),spc=pow(clamp(dot(reflect(-L,n),vec3(0,0,1)),0.,1.),24.),rim=pow(1.-n.z,2.)*h;
 vec3 bg=mix(vec3(.902,.91,.922),vec3(.047,.05,.067),uD);
 vec3 t1=mix(vec3(.70,.76,.95),vec3(.20,.25,.44),uD),t2=mix(vec3(.95,.80,.86),vec3(.31,.19,.31),uD);
 vec3 tc=mix(t1,t2,smoothstep(-.6,.6,uv.x+sin(uT*.2)*.3));
 float cal=mix(.4,1.,smoothstep(.1,.8,abs(uv.x)));
 vec3 dl=(tc-bg)*h*(mix(.4,.27,uD)+mix(.36,.28,uD)*dif)+mix(vec3(.09),vec3(.07,.08,.11),uD)*(spc*h+rim*.6)-(1.-uD)*rim*.04;
 vec3 col=bg+dl*cal+mix(vec3(.05),vec3(.05,.06,.09),uD)*rip;
 col+=(fract(sin(dot(gl_FragCoord.xy,vec2(12.9898,78.233)))*43758.5453)-.5)/255.;
 o=vec4(col,1.);}`;
function bg(env){
 // WebGL2 is the original, pixel-identical shader. WebGL1 runs the same
 // fragment equations when WebGL2 is disabled by hardware or browser policy.
 // Each API needs a NEW canvas: a canvas cannot switch context types.
 const options={antialias:false,alpha:false,powerPreference:'low-power',desynchronized:true};
 let c=null,gl=null,p=null,kind='';
 for(const candidate of ['webgl2','webgl']){
  if(failedGpuKinds.has(candidate))continue;
  const canvas=D.createElement('canvas');
  let ctx=null;
  try{ctx=canvas.getContext(candidate,options)}catch{continue}
  if(!ctx)continue;
  try{
   const is2=candidate==='webgl2';
   const vertex=is2?VS:'attribute vec2 aP;void main(){gl_Position=vec4(aP,0.,1.);}';
   const fragment=is2?FS:FS.replace('#version 300 es\n','')
     .replace('out vec4 o;','').replace('o=vec4(col,1.);','gl_FragColor=vec4(col,1.);');
   const shader=(type,source)=>{
    const sh=ctx.createShader(type);if(!sh)return null;
    ctx.shaderSource(sh,source);ctx.compileShader(sh);
    if(!ctx.getShaderParameter(sh,ctx.COMPILE_STATUS)){ctx.deleteShader(sh);return null}
    return sh;
   };
   const v=shader(ctx.VERTEX_SHADER,vertex),f=shader(ctx.FRAGMENT_SHADER,fragment);
   if(!v||!f){if(v)ctx.deleteShader(v);if(f)ctx.deleteShader(f);continue}
   const program=ctx.createProgram();if(!program){ctx.deleteShader(v);ctx.deleteShader(f);continue}
   ctx.attachShader(program,v);ctx.attachShader(program,f);
   ctx.linkProgram(program);
   const linked=ctx.getProgramParameter(program,ctx.LINK_STATUS);
   ctx.deleteShader(v);ctx.deleteShader(f);
   if(!linked){ctx.deleteProgram(program);continue}
   ctx.useProgram(program);
   if(!is2){
    const buffer=ctx.createBuffer(),attr=ctx.getAttribLocation(program,'aP');
    if(!buffer||attr<0){ctx.deleteProgram(program);continue}
    ctx.bindBuffer(ctx.ARRAY_BUFFER,buffer);
    ctx.bufferData(ctx.ARRAY_BUFFER,new Float32Array([-1,-1,3,-1,-1,3]),ctx.STATIC_DRAW);
    ctx.enableVertexAttribArray(attr);ctx.vertexAttribPointer(attr,2,ctx.FLOAT,false,0,0);
   }
   c=canvas;gl=ctx;p=program;kind=candidate;break;
  }catch{ /* shader/driver failure: try the other original API */ }
 }
 if(!gl){webglUnavailable=true;return null}
 c.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none';
 c._env=env;c._mode=kind;c._ready=false;
 const u=n=>gl.getUniformLocation(p,n),uR=u('uR'),uM=u('uM'),uT=u('uT'),uD=u('uD'),uK=u('uK[0]')||u('uK');
 // Match the initial React appearance before the very first WebGL frame.
 const readDark=()=>((D.querySelector('.archive-app,.auth-experience')?.dataset.theme||R.dataset.theme)==='dark'?1:0);
 const initialDark=readDark();
 const base=[.25,.35,.5][tier];let sc=base,ud=initialDark,W,H,mx=0,my=0,tx=0,ty=0,act=0,prev=0,ki=0,fr=0,ms=0,la=-1,dk=initialDark,fromDark=initialDark,changeAt=0,ok=1;
 const life=new AbortController(),signal=life.signal;
 const stop=()=>{
  if(!ok)return;
  ok=0;life.abort();c.remove();env.classList.remove('lg-gl');
  visualMode(env,'fallback','lines');
 };
 c._stop=stop;
 const fail=()=>{
  if(!ok)return;
  stop();if(G===c)G=null;
  // Give a transient GPU loss one bounded recovery attempt. If the same
  // renderer fails twice, attempt the other original WebGL API before CSS.
  if(++contextLossCount>1){
   failedGpuKinds.add(kind);contextLossCount=0;gpuRetryAt=0;
   if(failedGpuKinds.size===2)webglUnavailable=true;
  }else gpuRetryAt=performance.now()+700;
  requestAnimationFrame(scan);
  if(gpuRetryAt)setTimeout(scan,720);
 };
 const ks=new Float32Array(24),t0=performance.now(),T=()=>(performance.now()-t0)/1e3;
 const size=()=>{W=innerWidth;H=innerHeight;c.width=Math.max(2,W*sc|0);c.height=Math.max(2,H*sc|0);gl.viewport(0,0,c.width,c.height)};
 size();addEventListener('resize',size,{signal});
 const pt=e=>{if(calm)return;tx=(e.clientX-W/2)/H;ty=(H/2-e.clientY)/H;act=performance.now()};
 addEventListener('pointermove',pt,{passive:true,signal});
 // A drag started on empty glass/background must not accidentally select
 // the hint text as the pointer passes across it. Dragging from the actual
 // text (or inside an editor) keeps normal browser text selection.
 const selectableOrControl='a,button,input,textarea,select,option,label,h1,h2,h3,h4,h5,h6,p,span,kbd,small,strong,em,code,[contenteditable],[role="button"],[role="option"],[role="link"],[role="textbox"]';
 let backgroundPointer=null;
 const releaseBackground=e=>{if(!e||e.pointerId===backgroundPointer)backgroundPointer=null};
 D.addEventListener('selectstart',e=>{if(backgroundPointer!==null)e.preventDefault()},{capture:true,signal});
 addEventListener('pointerup',releaseBackground,{passive:true,signal});
 addEventListener('pointercancel',releaseBackground,{passive:true,signal});
 addEventListener('blur',()=>releaseBackground(),{passive:true,signal});
 addEventListener('pointerdown',e=>{
  pt(e);
  const target=e.target;
  const blank=e.pointerType==='mouse'&&e.isPrimary&&e.button===0&&target instanceof Element&&
    !!target.closest('.archive-app,.auth-experience')&&!target.closest(selectableOrControl);
  backgroundPointer=blank?e.pointerId:null;
  // The optical ripple is a background interaction, not a click on labels
  // or controls. No preventDefault on pointerdown, so inputs still blur.
  if(blank){ks.set([tx,ty,T(),1],ki*4);ki=(ki+1)%6}
 },{passive:true,signal});
 c.addEventListener('webglcontextlost',e=>{e.preventDefault();fail()},{signal});
 function loop(now){
  if(!ok)return;requestAnimationFrame(loop);if(D.hidden)return;
  const idle=now-act>4000,min=!c._ready?0:calm?85:idle||tier===0||'busy' in R.dataset?32:15;if(now-prev<min)return;
  const gap=now-prev,dt=Math.min(.1,gap/1e3);prev=now;if(gap<250){ms+=gap;fr++}
  if(fr>=45){const avg=ms/fr;fr=ms=0;                          // adapt resolution only; never stop the loop
   if(avg>min*1.6&&sc>.18){sc*=.8;size()}else if(avg<min*1.15&&sc<base){sc=Math.min(base,sc*1.12);size()}}
  const k=1-Math.exp(-dt*5);mx+=(tx-mx)*k;my+=(ty-my)*k;
  // Read every rendered frame: the old 30-frame polling left the light UI
  // stranded over a dark canvas for up to a second on low-end devices.
  const nextDark=readDark();
  if(nextDark!==dk){fromDark=ud;dk=nextDark;changeAt=now}
  const progress=calm?1:Math.min(1,Math.max(0,(now-changeAt)/580));
  const eased=progress*progress*(3-2*progress);
  ud=fromDark+(dk-fromDark)*eased;
  try{
   gl.uniform2f(uR,c.width,c.height);gl.uniform2f(uM,mx,my);
   gl.uniform1f(uT,calm?0:T());gl.uniform1f(uD,ud);gl.uniform4fv(uK,ks);
   gl.drawArrays(gl.TRIANGLES,0,3);
   // Detect a broken or lost driver before making the GL canvas visible.
   if(!c._ready&&(gl.isContextLost?.()||gl.getError()!==gl.NO_ERROR)){fail();return}
   if(!c._ready){
    if(!env.isConnected){stop();return}
    c._ready=true;env.prepend(c);env.classList.add('lg-gl');
    visualMode(env,'original',kind);
   }
  }catch{fail();return}
  if(tier===2){const a=Math.round((Math.atan2(mx,my)*57.296+360)%360/4)*4;if(a!==la){la=a;R.style.setProperty('--la',a+'deg')}} // rim light follows cursor
 }
 requestAnimationFrame(loop);
 return c;
}

/* On GPU failure, leave the original React UI untouched and reveal only the
   original lined CSS backdrop. No third Canvas2D/gradient appearance. */
scan();
})();
