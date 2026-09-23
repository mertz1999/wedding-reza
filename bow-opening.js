import { wedding } from './wedding-config.js';

const scene = document.querySelector('.scene');
const trigger = document.querySelector('.bow-hit');
const reveal = document.querySelector('.reveal');
const replay = document.querySelector('.replay');
const hint = document.querySelector('#hint');
const status = document.querySelector('#animation-status');
const motionPreview = document.querySelector('.motion-preview');
const leftDoor = document.querySelector('.door--left');
const rightDoor = document.querySelector('.door--right');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const svgNS = 'http://www.w3.org/2000/svg';
const duration = 5100;
let frameId = 0;
let startedAt = 0;
let opening = false;

document.querySelector('#bride').textContent = wedding.bride;
document.querySelector('#groom').textContent = wedding.groom;
const date = new Date(`${wedding.date}T12:00:00+03:30`);
if (!Number.isNaN(date.getTime())) {
  document.querySelector('#wedding-date').textContent = new Intl.DateTimeFormat('fa-IR', {
    day: 'numeric', month: 'long', year: 'numeric', timeZone: wedding.timeZone,
  }).format(date);
}
// Preserve personalized guest links when moving between the experiment and invitation.
document.querySelectorAll('a').forEach(link => {
  const target = new URL(link.href);
  target.search = location.search;
  link.href = target.href;
});

const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
const phase = (time, from, to) => smooth((time - from) / (to - from));
const mix = (a, b, t) => a + (b - a) * t;

// Every pose has the same four-cubic topology. The ribbon edges deform continuously;
// no image halves, frame swaps, or cross-faded closed/open bow assets are used.
const shapes = {
  band: [
    'M -231 -20 C -157 -19 -72 -16 -18 -15 C -9 -4 -9 21 -18 33 C -91 37 -165 39 -231 37 C -232 19 -232 -3 -231 -20 Z',
    'M -270 -16 C -169 -44 -87 -12 -18 -9 C -9 -2 -9 11 -18 18 C -101 3 -187 23 -274 38 C -276 24 -274 2 -270 -16 Z',
    'M -620 -75 C -471 30 -278 -67 -155 -10 C -151 -2 -153 10 -160 18 C -305 -30 -480 99 -638 -30 C -636 -46 -628 -61 -620 -75 Z',
  ],
  tail: [
    'M -16 5 C -83 9 -124 118 -169 164 C -193 192 -225 206 -250 219 C -218 222 -206 240 -194 259 C -95 199 -84 71 -16 24 Z',
    'M -16 5 C -64 15 -113 95 -186 128 C -225 145 -264 128 -296 152 C -270 163 -271 184 -277 200 C -155 182 -74 60 -16 24 Z',
    'M -60 5 C -177 -10 -298 62 -422 27 C -458 16 -492 -4 -534 -1 C -525 14 -526 40 -537 49 C -320 99 -199 16 -60 24 Z',
  ],
  back: [
    'M -23 7 C -79 -2 -151 -34 -179 -16 C -196 4 -147 39 -112 30 C -74 28 -43 16 -23 10 C -23 9 -23 8 -23 7 Z',
    'M -22 5 C -51 0 -86 -15 -103 -8 C -116 6 -80 24 -59 19 C -39 15 -29 11 -22 9 C -22 8 -22 7 -22 5 Z',
    'M -30 6 C -89 -6 -138 -5 -172 -3 C -192 1 -162 15 -128 13 C -90 12 -59 12 -30 10 C -30 9 -30 7 -30 6 Z',
  ],
  loop: [
    'M -23 -4 C -61 -45 -129 -122 -162 -103 C -177 -91 -201 -26 -179 -16 C -139 -30 -69 10 -23 10 C -28 5 -25 0 -23 -4 Z',
    'M -22 -3 C -47 -32 -77 -73 -94 -62 C -106 -54 -117 -15 -103 -8 C -77 -18 -47 10 -22 9 C -25 5 -24 0 -22 -3 Z',
    'M -30 -2 C -84 -21 -140 -32 -177 -20 C -191 -17 -194 -8 -172 -3 C -124 -17 -67 13 -30 10 C -33 5 -32 0 -30 -2 Z',
  ],
  knot: [
    'M -24 -18 C -9 -12 9 -21 24 -17 C 21 -3 21 14 25 28 C 9 24 -8 31 -24 26 C -27 11 -26 -4 -24 -18 Z',
    'M -25 -14 C -7 -20 21 -15 30 -6 C 25 3 14 21 8 27 C -10 23 -28 11 -29 4 C -30 -2 -29 -8 -25 -14 Z',
    'M -35 -9 C -12 -30 32 -17 50 -11 C 49 -3 45 6 41 13 C 6 -1 -6 2 -33 18 C -38 9 -39 -2 -35 -9 Z',
  ],
};
const parsePath = path => path.match(/-?\d+(?:\.\d+)?/g).map(Number);
const pathString = values => `M ${values.slice(0, 2).join(' ')} C ${values.slice(2).join(' ')} Z`;
const poses = Object.fromEntries(Object.entries(shapes).map(([key, paths]) => [key, paths.map(parsePath)]));
const pieces = [];
const root = document.querySelector('#ribbon-pieces');
const ribbonStage = document.querySelector('.ribbon-stage');
const envelope = document.querySelector('.envelope');

function addPiece(kind, side, fill) {
  const group = document.createElementNS(svgNS, 'g');
  const surface = document.createElementNS(svgNS, 'path');
  surface.setAttribute('fill', `url(#silk-${fill})`);
  surface.setAttribute('stroke', '#a78b5c');
  surface.setAttribute('stroke-width', '.65');
  const texture = document.createElementNS(svgNS, 'path');
  texture.setAttribute('fill', `url(#silk-${fill})`);
  texture.setAttribute('filter', 'url(#fabric)');
  texture.setAttribute('opacity', '.22');
  const edge = document.createElementNS(svgNS, 'path');
  edge.setAttribute('stroke', '#fff2d6');
  edge.setAttribute('stroke-opacity', '.68');
  edge.setAttribute('stroke-width', '1.1');
  edge.setAttribute('fill', 'none');
  group.append(surface, texture, edge);
  root.append(group);
  pieces.push({ kind, side, group, paths: [surface, texture, edge] });
}
for (const side of [-1, 1]) addPiece('band', side, 'band');
for (const side of [-1, 1]) addPiece('tail', side, 'tail');
for (const side of [-1, 1]) addPiece('back', side, 'back');
for (const side of [-1, 1]) addPiece('loop', side, 'loop');
addPiece('knot', 1, 'knot');

function render(time) {
  for (const piece of pieces) {
    const { kind, side, group, paths } = piece;
    // The right tail pulls first; the second loop follows after tension releases.
    const lag = side === 1 ? .15 : 0;
    const tighten = phase(time, .2 + lag, 1.55 + lag);
    const unfurl = phase(time, 1.55 + lag, 2.65 + lag);
    const fly = phase(time, 2.6 + lag, 3.9 + lag);
    const [closed, taut, loose] = poses[kind];
    const shape = closed.map((value, i) => mix(mix(value, taut[i], tighten), loose[i], unfurl));
    const d = pathString(shape);
    paths.forEach(path => path.setAttribute('d', d));
    const knot = kind === 'knot';
    const pull = knot ? -fly * 820 : -fly * 760;
    const curl = Math.sin(fly * Math.PI) * (kind === 'tail' ? 85 : -48);
    const tension = Math.sin(tighten * Math.PI) * -3;
    group.setAttribute('transform', `scale(${side} 1) translate(${pull} ${curl + tension}) rotate(${fly * (kind === 'tail' ? -24 : 12)})`);
    // The small inner fold disappears as its loop becomes flat, while the cloth
    // itself remains opaque until completely outside the composition.
    group.style.opacity = kind === 'back' ? String(1 - unfurl) : '1';
  }
  const doors = phase(time, 3.1, 4.8);
  leftDoor.style.transform = `rotateY(${-112 * doors}deg)`;
  rightDoor.style.transform = `rotateY(${112 * phase(time, 3.24, 4.94)}deg)`;
  const content = phase(time, 3.6, 4.95);
  reveal.style.opacity = String(mix(.25, 1, content));
  reveal.style.transform = `translateY(${(1 - content) * 8}px)`;
  envelope.style.transform = `translateY(${-doors * 4}px)`;
  hint.style.opacity = String(1 - phase(time, 0, .45));
}

function complete() {
  opening = false;
  scene.dataset.state = 'open';
  scene.removeAttribute('aria-busy');
  ribbonStage.style.visibility = 'hidden';
  reveal.inert = false;
  reveal.setAttribute('aria-hidden', 'false');
  trigger.setAttribute('aria-expanded', 'true');
  hint.hidden = true;
  replay.hidden = false;
  motionPreview.hidden = !reducedMotion.matches;
  status.textContent = 'The bow is untied. Your invitation is open.';
  reveal.querySelector('h2').focus({ preventScroll: true });
}

function tick(now) {
  const elapsed = Math.min(now - startedAt, duration);
  render(elapsed / 1000);
  if (elapsed < duration) frameId = requestAnimationFrame(tick);
  else complete();
}

function open(fullMotion = false) {
  if (scene.dataset.state !== 'closed') return;
  scene.dataset.state = 'opening';
  scene.setAttribute('aria-busy', 'true');
  trigger.disabled = true;
  opening = true;
  motionPreview.hidden = true;
  status.textContent = 'Untying the bow…';
  if (reducedMotion.matches && !fullMotion) {
    render(duration / 1000);
    complete();
    return;
  }
  startedAt = performance.now();
  frameId = requestAnimationFrame(tick);
}

function reset() {
  cancelAnimationFrame(frameId);
  opening = false;
  scene.dataset.state = 'closed';
  scene.removeAttribute('aria-busy');
  reveal.inert = true;
  reveal.setAttribute('aria-hidden', 'true');
  trigger.disabled = false;
  trigger.setAttribute('aria-expanded', 'false');
  replay.hidden = true;
  hint.hidden = false;
  ribbonStage.style.visibility = '';
  motionPreview.hidden = !reducedMotion.matches;
  render(0);
  status.textContent = 'The bow is tied. Touch it to open again.';
  trigger.focus({ preventScroll: true });
}

trigger.addEventListener('click', () => open());
replay.addEventListener('click', reset);
motionPreview.hidden = !reducedMotion.matches;
motionPreview.addEventListener('click', () => {
  reset();
  open(true);
});
reducedMotion.addEventListener('change', () => {
  motionPreview.hidden = !reducedMotion.matches || opening;
  if (reducedMotion.matches && opening) {
    cancelAnimationFrame(frameId);
    render(duration / 1000);
    complete();
  }
});
render(0);
