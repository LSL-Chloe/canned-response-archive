import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { test } from 'node:test';

const source = readFileSync(new URL('../public/liquid-glass.js', import.meta.url), 'utf8');

function browser({ webgl2 = true, webgl1 = true, canvas2d = true, failGL2Shader = false,
  reducedMotion = false, reducedTransparency = false, invalidFirstFrame = false } = {}) {
  let now = 0;
  const contexts = [], shaderSources = [], calls = [], frames = [], timers = [];
  const handlers = new Map(), canvases = [], fills = [], classes = new Set();

  class Element {
    constructor(tag) {
      this.tag = tag;this.style = { setProperty() {}, removeProperty() {} };this.dataset = {};
      this.isConnected = true;this.attrs = {};this.children = [];
      this.localHandlers = new Map();
    }
    setAttribute(k, v) { this.attrs[k] = v; }
    getAttribute(k) { return this.attrs[k] ?? null; }
    hasAttribute(k) { return k in this.attrs; }
    append(...items) { for (const item of items) { this.children.push(item);item.isConnected = true; } }
    prepend(item) { this.children.unshift(item);item.isConnected = true; }
    remove() { this.isConnected = false; }
    closest() { return null; }
    addEventListener(type, cb, options = {}) {
      const list = this.localHandlers.get(type) || [];
      list.push({ cb, signal: options.signal });this.localHandlers.set(type, list);
    }
    dispatch(type, event = {}) {
      for (const {cb,signal} of this.localHandlers.get(type) || [])
        if (!signal?.aborted) cb({ preventDefault() {}, ...event });
    }
  }
  const ctx2d = () => ({
    createRadialGradient() { return { addColorStop() {} }; },
    fillRect() { fills.push(this.fillStyle); },
    beginPath() {}, arc() {}, stroke() {},
  });
  function glContext(kind) {
    let lastError = invalidFirstFrame ? 1282 : 0;
    return {
      VERTEX_SHADER: 35633, FRAGMENT_SHADER: 35632, COMPILE_STATUS: 35713,
      LINK_STATUS: 35714, ARRAY_BUFFER: 34962, STATIC_DRAW: 35044,
      FLOAT: 5126, TRIANGLES: 4, NO_ERROR: 0,
      createShader() { return {}; },
      shaderSource(shader, s) { shaderSources.push({kind, source: s}); },
      compileShader() {}, getShaderParameter() { return !(failGL2Shader && kind === 'webgl2'); },
      deleteShader() {}, createProgram() { return {}; },
      attachShader() {}, linkProgram() {}, getProgramParameter() { return true; },
      useProgram() {}, getUniformLocation() { return {}; },
      createBuffer() { return {}; }, getAttribLocation() { return 0; },
      bindBuffer() {}, bufferData() {}, enableVertexAttribArray() {}, vertexAttribPointer() {},
      deleteProgram() {}, viewport() {},
      uniform2f() {}, uniform1f() {}, uniform4fv() {},
      drawArrays() { calls.push(kind + ':draw'); },
      getError() { const e = lastError;lastError = 0;return e; },
      isContextLost() { return false; },
    };
  }
  const doc = {
    documentElement: new Element('html'), body: new Element('body'), head: new Element('head'),
    createElement(tag) {
      const el = new Element(tag);
      if (tag === 'canvas') {
        canvases.push(el);
        el.getContext = kind => {
          contexts.push(kind);
          if (kind === 'webgl2') return webgl2 ? glContext(kind) : null;
          if (kind === 'webgl') return webgl1 ? glContext(kind) : null;
          if (kind === '2d') return canvas2d ? ctx2d() : null;
          return null;
        };
      }
      return el;
    },
    createElementNS(ns, tag) { return new Element(tag); },
    getElementById() { return null; },
    querySelector(selector) {
      if (selector === '.archive-app') return app;
      if (selector === '.archive-app,.auth-experience') return app;
      if (selector === '.optical-environment') return env;
      return null;
    },
    querySelectorAll() { return []; },
    addEventListener(type, cb) { handlers.set('document:' + type, cb); },
  };
  const app = new Element('app');app.dataset.theme = 'dark';
  const env = new Element('environment');
  env.classList = {
    add(v) { classes.add(v); }, remove(v) { classes.delete(v); },
    contains(v) { return classes.has(v); },
  };
  const sandbox = {
    window: {},document: doc,Element,
    navigator: { deviceMemory: 8, hardwareConcurrency: 8, connection: {saveData: false} },
    CSS: {supports: () => false},
    matchMedia: q => ({matches: q.includes('reduced-motion') ? reducedMotion :
      q.includes('reduced-transparency') ? reducedTransparency : false}),
    ResizeObserver: class { observe() {} },
    MutationObserver: class { observe() {} },
    AbortController,
    addEventListener(type, cb, opts = {}) {
      const list = handlers.get(type) || [];
      list.push({cb,signal:opts.signal});handlers.set(type,list);
    },
    innerWidth: 1200,innerHeight: 700,
    performance: {now: () => now},
    requestAnimationFrame(cb) { frames.push(cb); return frames.length; },
    cancelAnimationFrame() {},
    setTimeout(cb) { timers.push(cb); return timers.length; },
    clearTimeout() {},
    console,
  };
  assert.doesNotThrow(() => runInNewContext(source, sandbox, {timeout: 2000}));
  return {
    app, env, contexts, shaderSources, fills, canvases, classes, calls, frames, timers,
    frame(t) { now = t; const jobs = frames.splice(0); for (const cb of jobs) cb(t); },
    clearTimers() { while(timers.length) timers.shift()(); },
    activeClasses() { return Array.from(classes); },
    activeListeners(type) { return (handlers.get(type) || []).filter(x => !x.signal?.aborted).length; },
    fire(type, event) {
      for (const {cb, signal} of handlers.get(type) || [])
        if (!signal?.aborted) cb(event);
    },
    backgroundTarget() {
      const el = new Element('background');
      el.closest = selector => selector.includes('.archive-app') ? {} : null;
      return el;
    },
    selectionStart(event) { handlers.get('document:selectstart')?.(event); },
  };
}

test('original WebGL2 shader runs first, and only hides CSS after its first successful frame', () => {
  const ui = browser();
  assert.deepEqual(ui.contexts, ['webgl2']);
  assert.equal(ui.classes.has('lg-gl'), false);
  assert.equal(ui.env.dataset.visualMode, 'fallback', 'Keep matched backdrop until original first frame is valid');
  ui.frame(42);
  assert.equal(ui.env.dataset.ambientMode, 'webgl2');
  assert.equal(ui.env.dataset.visualMode, 'original');
  assert.equal(ui.classes.has('lg-gl'), true);
  assert.ok(ui.calls.includes('webgl2:draw'));
});

test('when WebGL2 is disabled, WebGL1 compiles the same fragment equations before Canvas2D', () => {
  const ui = browser({webgl2: false});
  assert.deepEqual(ui.contexts, ['webgl2', 'webgl']);
  assert.ok(ui.shaderSources.some(x => x.kind === 'webgl' && x.source.includes('gl_FragColor=vec4(col,1.);')));
  assert.ok(ui.shaderSources.every(x => x.kind !== 'webgl' || !x.source.includes('#version 300 es')));
  ui.frame(45);
  assert.equal(ui.env.dataset.ambientMode, 'webgl');
  assert.equal(ui.env.dataset.visualMode, 'original');
});

test('failed WebGL2 shader compilation tries WebGL1 rather than exposing the grid', () => {
  const ui = browser({failGL2Shader: true});
  assert.deepEqual(ui.contexts, ['webgl2', 'webgl']);
  ui.frame(48);
  assert.equal(ui.env.dataset.ambientMode, 'webgl');
  assert.equal(ui.env.dataset.visualMode, 'original');
});

test('a failed first WebGL frame reveals lined CSS without a blank or a third renderer', () => {
  const ui = browser({invalidFirstFrame: true});
  ui.frame(48);
  assert.equal(ui.classes.has('lg-gl'), false);
  assert.equal(ui.env.dataset.ambientMode, 'lines');
  assert.equal(ui.env.dataset.visualMode, 'fallback');
  assert.ok(!ui.contexts.includes('2d'));
});

test('when GPU APIs are unavailable, CSS lines are the ONLY backup', () => {
  const ui = browser({webgl2:false,webgl1:false});
  assert.deepEqual(ui.contexts, ['webgl2', 'webgl']);
  assert.equal(ui.env.dataset.ambientMode, 'lines');
  assert.equal(ui.env.dataset.visualMode, 'fallback');
  assert.equal(ui.classes.has('lg-gl'), false);
  ui.frame(48);
  assert.equal(ui.env.dataset.ambientMode, 'lines');
});

test('reduced motion still uses the original static shader if supported', () => {
  const ui = browser({reducedMotion:true});
  assert.deepEqual(ui.contexts, ['webgl2']);
  ui.frame(48);
  assert.equal(ui.env.dataset.ambientMode, 'webgl2');
  assert.equal(ui.env.dataset.visualMode, 'original');
  assert.ok(ui.calls.includes('webgl2:draw'));
});

test('a lost GPU context shows lined fallback and releases old input listeners', () => {
  const ui = browser();
  ui.frame(44);
  assert.equal(ui.env.dataset.ambientMode, 'webgl2');
  assert.equal(ui.env.dataset.visualMode, 'original');
  const listenersBefore = ui.activeListeners('pointermove');
  ui.canvases[0].dispatch('webglcontextlost');
  assert.equal(ui.classes.has('lg-gl'), false);
  assert.equal(ui.env.dataset.ambientMode, 'lines');
  assert.equal(ui.env.dataset.visualMode, 'fallback');
  assert.ok(ui.activeListeners('pointermove') < listenersBefore,
    'Lost GPU contexts must release their input listeners');
  ui.clearTimers();
  ui.frame(850); // Retry starts a new canvas after the bounded cooldown.
  assert.equal(ui.env.dataset.ambientMode, 'lines', 'Keep fallback until a valid frame is drawn');
  ui.frame(900); // The first valid GPU frame activates the original visual mode.
  assert.equal(ui.env.dataset.ambientMode, 'webgl2');
  assert.equal(ui.env.dataset.visualMode, 'original');
});

test('glass-control animation styles remain unconditional and renderer-independent', () => {
  const ui = browser({webgl2:false,webgl1:false});
  assert.ok(ui.app && ui.env);
  const src = readFileSync(new URL('../public/liquid-glass.js', import.meta.url), 'utf8');
  const palette = readFileSync(new URL('../src/styles/premium.css', import.meta.url), 'utf8');
  assert.ok(src.indexOf('/* ───────── MATERIAL (CSS) ───────── */') <
    src.indexOf('/* ───────── REACTIVE 3D BACKGROUND'),
    'Original glass-control transitions must initialize before GPU startup');
  assert.match(src, /\.archive-nav-selection,\.archive-tabs-lens,\.auth-tabs-lens,\.archive-visibility-lens\{transition:transform/);
  assert.match(src, /\.liquid-theme-switch \.liquid-switch-thumb\{transition:transform \.58s/);
  assert.match(src, /\.liquid-action,\.archive-button,\.archive-sign-in-link\{transition:transform/);
  assert.match(src, /\.liquid-action:hover,\.archive-button:hover,\.archive-sign-in-link:hover/);
  assert.match(palette, /repeating-linear-gradient/);
  assert.match(palette, /@property --a-bg/);
});

test('lined fallback does not obstruct ordinary text selection or inputs', () => {
  const ui = browser({webgl2:false,webgl1:false});
  const e = {
    pointerId: 1,pointerType: 'mouse',isPrimary: true,button: 0,
    target: ui.backgroundTarget(),clientX: 640,clientY: 280,
  };
  ui.fire('pointerdown', e);
  let prevented = false;
  ui.selectionStart({preventDefault() { prevented = true; }});
  assert.equal(prevented, false, 'The CSS-only backdrop has no selection interceptor');
});
