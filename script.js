import { showWeddingCard, invitationDataReady } from "./invitation-page.js?v=20260923-3";

const paper = document.querySelector(".paper");
const swans = document.querySelector(".swans");
const leftSwan = document.querySelector(".swan--left");
const rightSwan = document.querySelector(".swan--right");
const openingParticles = document.querySelector(".opening-particles");
const invitationMusic = document.querySelector("#invitation-music");
const invitationApp = document.querySelector(".invitation-app");
const loaderProgress = document.querySelector("#loader-progress");
const loaderPercent = document.querySelector("#loader-percent");
const musicStartAt = 3;
const AudioContextClass = window.AudioContext || window.webkitAudioContext;
let musicBytesPromise;
const criticalAssetUrls = [
  "./src/assets/swan-lake-background-mobile.jpg",
  "./src/assets/white-swan-mobile.png",
  "./src/assets/pink-water-lily-mobile.png",
];
const cardAssetUrls = [
  "./src/assets/pink-orchid-branch-mobile.png",
  "./src/assets/hands-bouquet-cutout-mobile.png",
  "./src/assets/wedding-hands-bg-mobile.jpg",
];

const particleBlueprints = [
  [8, 24, 3, -1.2, 6.8, 10, -12, -3],
  [17, 41, 2, -4.6, 8.2, 16, -8, 7],
  [27, 18, 4, -2.8, 7.4, 12, -15, 3],
  [37, 62, 2, -6.1, 6.2, 9, -6, 10],
  [45, 27, 3, -3.7, 8.8, 14, -3, -5],
  [53, 73, 2, -1.9, 7.8, 11, 3, 9],
  [62, 20, 3, -5.4, 6.6, 15, 7, -4],
  [72, 48, 4, -.8, 8.5, 10, 11, 5],
  [84, 29, 2, -4.2, 7.1, 13, 15, -2],
  [93, 65, 3, -2.5, 6.4, 8, 17, 8],
  [12, 76, 2, -5.9, 8.9, 12, -16, 11],
  [23, 55, 3, -.6, 7.6, 15, -11, 6],
  [34, 35, 2, -3.1, 6.9, 9, -7, -1],
  [48, 52, 4, -6.5, 8.1, 13, -2, 5],
  [59, 39, 2, -1.4, 7.3, 11, 5, 1],
  [68, 68, 3, -4.9, 8.7, 16, 9, 10],
  [79, 16, 2, -2.2, 6.5, 8, 13, -6],
  [89, 79, 3, -5.6, 7.9, 14, 16, 12],
];

particleBlueprints.forEach(([x, y, size, delay, duration, drift, targetX, targetY], index) => {
  const particle = document.createElement("i");
  particle.className = `opening-particle opening-particle--${index % 3 === 0 ? "pearl" : "gold"}`;
  particle.style.setProperty("--x", `${x}%`);
  particle.style.setProperty("--y", `${y}%`);
  particle.style.setProperty("--size", `${size}px`);
  particle.style.setProperty("--delay", `${delay}s`);
  particle.style.setProperty("--duration", `${duration}s`);
  particle.style.setProperty("--drift", `${drift}px`);
  particle.style.setProperty("--target-x", `${targetX}px`);
  particle.style.setProperty("--target-y", `${targetY}px`);
  openingParticles?.append(particle);
});

function loadMusicBytes() {
  if (!invitationMusic || !AudioContextClass) return null;
  musicBytesPromise ||= fetch(invitationMusic.src).then((response) => {
      if (!response.ok) throw new Error("The invitation music could not be loaded.");
      return response.arrayBuffer();
    });
  return musicBytesPromise;
}

function preloadImage(url) {
  return new Promise((resolve) => {
    const image = new Image();
    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      resolve(url);
    };
    image.onload = finish;
    image.onerror = finish;
    image.src = url;
    if (image.complete) finish();
    else image.decode?.().then(finish, () => undefined);
  });
}

function updateLoadingProgress(completed, total) {
  const progress = Math.round((completed / total) * 100);
  if (loaderProgress) loaderProgress.style.width = `${progress}%`;
  if (loaderPercent) loaderPercent.textContent = `${new Intl.NumberFormat("fa-IR").format(progress)}٪`;
}

async function prepareInvitation() {
  const startedAt = performance.now();
  const tasks = [
    ...criticalAssetUrls.map(preloadImage),
    invitationDataReady.catch(() => undefined),
    document.fonts?.load('32px "Iran Nastaliq"'),
  ];
  let completed = 0;
  updateLoadingProgress(0, tasks.length);

  await Promise.allSettled(tasks.map((task) => Promise.resolve(task).finally(() => {
    completed += 1;
    updateLoadingProgress(completed, tasks.length);
  })));

  const remaining = 650 - (performance.now() - startedAt);
  if (remaining > 0) await new Promise((resolve) => window.setTimeout(resolve, remaining));

  document.body.classList.remove("is-loading");
  document.body.classList.add("is-ready");
  invitationApp.removeAttribute("aria-hidden");
  window.setTimeout(() => document.querySelector("#app-loader")?.remove(), 900);

  // Warm the card artwork after the opening screen is usable. Music waits for the first tap.
  void Promise.allSettled(cardAssetUrls.map(preloadImage));
}

const invitationReady = prepareInvitation();
let musicFadeFrame;
let bufferedMusicStarted = false;

function fadeMusicIn(targetVolume = .68, duration = 2200) {
  if (musicFadeFrame) cancelAnimationFrame(musicFadeFrame);
  const startedAt = performance.now();

  const step = (now) => {
    const progress = Math.min(1, (now - startedAt) / duration);
    invitationMusic.volume = targetVolume * (1 - Math.pow(1 - progress, 3));
    if (progress < 1) musicFadeFrame = requestAnimationFrame(step);
  };

  musicFadeFrame = requestAnimationFrame(step);
}

function startHtmlInvitationMusic() {
  if (!invitationMusic || !invitationMusic.paused) return;
  invitationMusic.dataset.playbackEngine = "html-audio";

  const seekToOpening = () => {
    try { invitationMusic.currentTime = musicStartAt; } catch { /* Metadata is still loading. */ }
  };

  invitationMusic.volume = 0;
  if (invitationMusic.readyState >= HTMLMediaElement.HAVE_METADATA) seekToOpening();
  else invitationMusic.addEventListener("loadedmetadata", seekToOpening, { once: true });
  invitationMusic.addEventListener("playing", () => {
    if (invitationMusic.currentTime < musicStartAt) seekToOpening();
  }, { once: true });

  const playback = invitationMusic.play();
  if (playback) {
    playback
      .then(() => {
        if (invitationMusic.currentTime < musicStartAt) seekToOpening();
        for (const delay of [120, 480, 900]) {
          window.setTimeout(() => {
            if (invitationMusic.currentTime < musicStartAt) seekToOpening();
          }, delay);
        }
        fadeMusicIn();
      })
      .catch(() => undefined);
  }
}

function startInvitationMusic() {
  const bytesPromise = loadMusicBytes();
  if (!AudioContextClass || !bytesPromise || bufferedMusicStarted) {
    startHtmlInvitationMusic();
    return;
  }

  bufferedMusicStarted = true;
  const context = new AudioContextClass();
  const resumePlayback = context.resume();

  Promise.all([resumePlayback, bytesPromise])
    .then(([, bytes]) => context.decodeAudioData(bytes.slice(0)))
    .then((buffer) => {
      const source = context.createBufferSource();
      const gain = context.createGain();
      const now = context.currentTime;

      source.buffer = buffer;
      source.connect(gain).connect(context.destination);
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(.68, now + 2.2);
      source.start(0, Math.min(musicStartAt, Math.max(0, buffer.duration - .1)));
      invitationMusic.dataset.playbackEngine = "web-audio";
      invitationMusic.dataset.startedAt = String(musicStartAt);
      invitationMusic.dataset.duration = String(buffer.duration);
    })
    .catch(() => {
      bufferedMusicStarted = false;
      startHtmlInvitationMusic();
    });
}

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function invitationOpened() {
  swans.disabled = true;
  paper.setAttribute("aria-busy", "true");
  document.documentElement.classList.add("invitation-is-transitioning");
  showWeddingCard({ keepPaper: true });
  paper.classList.add("is-departing");

  // Crossfade the completed swan scene over the entering card.
  await wait(900);
  paper.hidden = true;
  document.documentElement.classList.remove("invitation-is-transitioning");
  paper.removeAttribute("aria-busy");
}

paper.classList.add("uses-waapi");

const swanTiming = {
  duration: 3800,
  easing: "cubic-bezier(.55, 0, .18, 1)",
  fill: "forwards",
};

function swanFrames(direction) {
  return [
    { offset: 0, x: -7, opacity: .96 },
    { offset: .2, x: -3, opacity: 1 },
    { offset: .54, x: 6, opacity: 1 },
    { offset: .78, x: 11, opacity: 1 },
    { offset: .9, x: 12, opacity: 1 },
    { offset: 1, x: 12, opacity: 0 },
  ].map(({ offset, x, opacity }) => ({
    offset,
    opacity,
    transform: `translateX(${x * direction}%) translateY(4%) scale(.92) rotate(${-2 * direction}deg)`,
  }));
}

function finishInstantly() {
  paper.dataset.animationEngine = "fallback";
  swans.setAttribute("aria-expanded", "true");
  paper.classList.add("is-open");
  void invitationOpened();
}

async function openInvitation() {
  if (paper.classList.contains("is-animating") || paper.classList.contains("is-open")) return;

  startInvitationMusic();

  if (typeof Element.prototype.animate !== "function") {
    finishInstantly();
    return;
  }

  paper.dataset.animationEngine = "web-animations-api";
  paper.dataset.timelineDuration = String(swanTiming.duration);
  swans.setAttribute("aria-expanded", "true");
  paper.setAttribute("aria-busy", "true");
  paper.classList.add("is-animating", "is-opening");

  const animations = [
    leftSwan.animate(swanFrames(1), swanTiming),
    rightSwan.animate(swanFrames(-1), swanTiming),
  ];

  await Promise.all(animations.map((animation) => animation.finished.catch(() => undefined)));

  paper.classList.remove("is-animating", "is-opening");
  paper.classList.add("is-open");
  paper.removeAttribute("aria-busy");
  animations.forEach((animation) => animation.cancel());
  await invitationOpened();
}

paper.addEventListener("click", openInvitation);

// Skip the swan opening when a direct link targets the full card.
if (window.location.hash === "#wedding-card") void invitationReady.then(showWeddingCard);
