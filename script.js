import { showWeddingCard, invitationDataReady } from "./invitation-page.js?v=20260925-3";

const paper = document.querySelector(".paper");
const swans = document.querySelector(".swans");
const leftSwan = document.querySelector(".swan--left");
const rightSwan = document.querySelector(".swan--right");
const openingParticles = document.querySelector(".opening-particles");
const waterTouchEffects = document.querySelector(".water-touch-effects");
const cardParticles = document.querySelector(".card-particles");
const invitationMusic = document.querySelector("#invitation-music");
const musicToggle = document.querySelector("#music-toggle");
const invitationApp = document.querySelector(".invitation-app");
const loaderProgress = document.querySelector("#loader-progress");
const loaderPercent = document.querySelector("#loader-percent");
const musicStartAt = 3;
const musicTargetVolume = .68;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
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

function tehranHour() {
  const hour = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Tehran",
    hour: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date()).find((part) => part.type === "hour")?.value;
  return Number(hour ?? new Date().getHours());
}

function openingAmbience(hour) {
  if (hour >= 5 && hour < 10) return "morning";
  if (hour >= 10 && hour < 17) return "day";
  if (hour >= 17 && hour < 21) return "evening";
  return "night";
}

paper.dataset.ambience = openingAmbience(tehranHour());

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

const cardParticleBlueprints = [
  [7, 4, 2, -1.4, 7.8, 7], [91, 8, 3, -5.1, 9.2, 9],
  [12, 13, 3, -3.8, 8.4, 6], [95, 17, 2, -6.2, 7.5, 8],
  [5, 22, 4, -4.5, 10.1, 10], [88, 27, 2, -2.2, 8.7, 7],
  [14, 32, 2, -7.1, 9.5, 9], [96, 36, 3, -3.3, 7.9, 6],
  [8, 41, 3, -5.7, 8.9, 8], [90, 46, 4, -1.8, 10.4, 10],
  [4, 51, 2, -6.8, 7.7, 7], [94, 56, 3, -4.1, 9.6, 9],
  [11, 61, 4, -2.7, 10.2, 8], [87, 66, 2, -5.9, 8.3, 6],
  [6, 71, 3, -3.5, 9.1, 10], [96, 75, 2, -7.3, 7.6, 7],
  [13, 80, 2, -1.1, 8.6, 6], [89, 84, 4, -4.8, 10.5, 9],
  [5, 89, 3, -6.4, 9.3, 8], [94, 94, 2, -2.9, 7.8, 7],
  [16, 97, 3, -5.3, 8.8, 9], [83, 99, 2, -3.9, 9.7, 6],
];

cardParticleBlueprints.forEach(([x, y, size, delay, duration, drift]) => {
  const particle = document.createElement("i");
  particle.className = "card-particle";
  particle.style.setProperty("--x", `${x}%`);
  particle.style.setProperty("--y", `${y}%`);
  particle.style.setProperty("--size", `${size}px`);
  particle.style.setProperty("--delay", `${delay}s`);
  particle.style.setProperty("--duration", `${duration}s`);
  particle.style.setProperty("--drift", `${drift}px`);
  cardParticles?.append(particle);
});

function createWaterRipple(clientX, clientY) {
  if (!waterTouchEffects || reducedMotion.matches || paper.classList.contains("is-open")) return;
  const bounds = paper.getBoundingClientRect();
  const x = Math.min(bounds.width - 12, Math.max(12, clientX - bounds.left));
  const y = Math.min(bounds.height - 18, Math.max(bounds.height * .38, clientY - bounds.top));
  const effect = document.createElement("span");
  effect.className = "touch-effect";
  effect.style.left = `${x}px`;
  effect.style.top = `${y}px`;
  effect.innerHTML = `
    <b class="touch-ripple"></b>
    <i class="touch-spark" style="--spark-x:-24px;--spark-y:-19px"></i>
    <i class="touch-spark" style="--spark-x:22px;--spark-y:-15px"></i>
    <i class="touch-spark" style="--spark-x:4px;--spark-y:-29px"></i>
  `;
  waterTouchEffects.append(effect);
  window.setTimeout(() => effect.remove(), 1700);
}

paper.addEventListener("pointerdown", (event) => {
  createWaterRipple(event.clientX, event.clientY);
}, { passive: true });

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
let musicFadeTimer;
let musicPlayPending;
let musicStartedAtOpening = false;
let musicEverPlayed = false;

function setMusicControl(state) {
  if (!musicToggle) return;
  const playing = state === "playing";
  musicToggle.dataset.state = state;
  musicToggle.setAttribute("aria-pressed", String(playing));
  musicToggle.setAttribute("aria-label", playing ? "توقف موسیقی" : state === "loading" ? "در حال آماده‌سازی موسیقی" : "پخش موسیقی");
  musicToggle.title = playing ? "توقف موسیقی" : "پخش موسیقی";
}

function revealMusicControl() {
  if (!musicToggle) return;
  musicToggle.hidden = false;
  setMusicControl(invitationMusic && !invitationMusic.paused ? "playing" : invitationMusic?.dataset.playbackStatus === "blocked" ? "blocked" : "paused");
}

function seekToMusicOpening() {
  if (musicStartedAtOpening || !invitationMusic || invitationMusic.readyState < HTMLMediaElement.HAVE_METADATA) return musicStartedAtOpening;
  try {
    const latestStart = Number.isFinite(invitationMusic.duration) ? Math.max(0, invitationMusic.duration - .1) : musicStartAt;
    invitationMusic.currentTime = Math.min(musicStartAt, latestStart);
    invitationMusic.dataset.startedAt = String(invitationMusic.currentTime);
    invitationMusic.dataset.duration = String(invitationMusic.duration);
    musicStartedAtOpening = true;
    return true;
  } catch {
    return false;
  }
}

function fadeMusicIn(targetVolume = musicTargetVolume, duration = 2200) {
  if (musicFadeTimer) clearInterval(musicFadeTimer);
  const startedAt = performance.now();
  const audibleFloor = Math.min(.12, targetVolume);
  invitationMusic.volume = audibleFloor;

  const step = () => {
    const now = performance.now();
    const progress = Math.min(1, (now - startedAt) / duration);
    invitationMusic.volume = audibleFloor + (targetVolume - audibleFloor) * (1 - Math.pow(1 - progress, 3));
    if (progress >= 1) {
      clearInterval(musicFadeTimer);
      musicFadeTimer = undefined;
    }
  };

  musicFadeTimer = window.setInterval(step, 80);
}

function playInvitationMusic({ fade = !musicEverPlayed } = {}) {
  if (!invitationMusic) return Promise.resolve(false);
  if (!invitationMusic.paused) {
    setMusicControl("playing");
    return Promise.resolve(true);
  }
  if (musicPlayPending) return musicPlayPending;

  invitationMusic.dataset.playbackEngine = "html-audio";
  invitationMusic.dataset.playbackStatus = "starting";
  setMusicControl("loading");

  const startingAtOpening = !musicStartedAtOpening;
  invitationMusic.volume = fade ? 0 : musicTargetVolume;

  // Keep play() in the synchronous user-gesture call stack for Safari and in-app browsers.
  const playback = invitationMusic.play();
  if (!playback) {
    invitationMusic.addEventListener("playing", () => {
      if (startingAtOpening) seekToMusicOpening();
      invitationMusic.dataset.playbackStatus = "playing";
      musicEverPlayed = true;
      setMusicControl("playing");
      if (fade) fadeMusicIn();
    }, { once: true });
    return Promise.resolve(true);
  }

  musicPlayPending = playback
    .then(() => {
      if (startingAtOpening) seekToMusicOpening();
      invitationMusic.dataset.playbackStatus = "playing";
      invitationMusic.dataset.playbackError = "";
      musicEverPlayed = true;
      setMusicControl("playing");
      if (fade) fadeMusicIn();
      else invitationMusic.volume = musicTargetVolume;
      return true;
    })
    .catch((error) => {
      invitationMusic.dataset.playbackStatus = "blocked";
      invitationMusic.dataset.playbackError = error?.name || "PLAYBACK_FAILED";
      invitationMusic.volume = musicTargetVolume;
      setMusicControl("blocked");
      return false;
    })
    .finally(() => {
      musicPlayPending = undefined;
    });

  return musicPlayPending;
}

function startInvitationMusic() {
  void playInvitationMusic();
}

musicToggle?.addEventListener("click", () => {
  if (!invitationMusic) return;
  if (invitationMusic.paused) {
    void playInvitationMusic({ fade: false });
    return;
  }
  if (musicFadeTimer) clearInterval(musicFadeTimer);
  musicFadeTimer = undefined;
  invitationMusic.pause();
  invitationMusic.dataset.playbackStatus = "paused";
  setMusicControl("paused");
});

invitationMusic?.addEventListener("playing", () => {
  invitationMusic.dataset.playbackStatus = "playing";
  setMusicControl("playing");
});

invitationMusic?.addEventListener("pause", () => {
  if (!invitationMusic.ended) setMusicControl("paused");
});

invitationMusic?.addEventListener("ended", () => {
  musicStartedAtOpening = false;
  invitationMusic.dataset.playbackStatus = "ended";
  setMusicControl("paused");
});

invitationMusic?.addEventListener("error", () => {
  invitationMusic.dataset.playbackStatus = "blocked";
  invitationMusic.dataset.playbackError = invitationMusic.error?.message || "MEDIA_ERROR";
  setMusicControl("blocked");
});

const wait = (milliseconds) => new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function invitationOpened() {
  swans.disabled = true;
  paper.setAttribute("aria-busy", "true");
  document.documentElement.classList.add("invitation-is-transitioning");
  showWeddingCard({ keepPaper: true });
  revealMusicControl();
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

paper.addEventListener("click", (event) => {
  if (event.detail === 0) {
    const bounds = paper.getBoundingClientRect();
    createWaterRipple(bounds.left + bounds.width / 2, bounds.top + bounds.height * .56);
  }
  void openInvitation();
});

// Skip the swan opening when a direct link targets the full card.
if (window.location.hash === "#wedding-card") {
  void invitationReady.then(() => {
    showWeddingCard();
    revealMusicControl();
  });
}
