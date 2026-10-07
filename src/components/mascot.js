// ====================================================================
// CLOUDY BUDGET - CINNAMOROLL-INSPIRED INTERACTIVE MASCOT COMPONENT
// ====================================================================

import { playPuppyChirp } from '../lib/audio.js';
import { firePastelConfetti } from '../lib/confetti.js';

const MASCOT_IMAGES = {
  happy: '/assets/mascot/happy.jpg',
  celebrate: '/assets/mascot/celebrate.jpg',
  worried: '/assets/mascot/worried.jpg',
  sad: '/assets/mascot/sad.jpg',
};

const QUOTES = {
  happy: [
    "You're doing fantastic! ☁️",
    "Plenty of cloud budget left today! 🐾",
    "Proud of your smart savings! 💖",
    "Wiggle wiggle! Tap me for good luck! ✨",
    "A cozy day with safe finances! ☕",
  ],
  celebrate: [
    "WOOHOO! Goal reached! 🎉👑",
    "Crown for the budget queen! 🌟",
    "High paws! You made it happen! 🐾",
    "Sparkles everywhere! Keep shining! ✨",
  ],
  worried: [
    "Careful! Over 70% of budget used 😳",
    "Let's be extra mindful with treats today 🧋",
    "Floating gently... let's save what's left! ☁️",
    "Check upcoming bills before splurging! 🧾",
  ],
  sad: [
    "Oh no, we exceeded the budget! 😢",
    "Don't worry, every month is a fresh cloud! 🌧️",
    "Let's pause shopping and cuddle up! 🐾",
    "Tomorrow is a fresh start to save! 💙",
  ],
};

export function renderMascot({ mood = 'happy', customQuote = null }) {
  const container = document.createElement('div');
  container.className = 'hero-mascot-box';

  const quotesList = QUOTES[mood] || QUOTES.happy;
  const initialQuote = customQuote || quotesList[Math.floor(Math.random() * quotesList.length)];

  // Speech bubble
  const bubble = document.createElement('div');
  bubble.className = 'speech-bubble';
  bubble.textContent = initialQuote;

  // Mascot image wrap
  const imgWrap = document.createElement('div');
  imgWrap.className = 'mascot-img-wrap anim-bounce';
  imgWrap.title = 'Click to pet me!';

  const img = document.createElement('img');
  img.className = 'mascot-img';
  img.src = MASCOT_IMAGES[mood] || MASCOT_IMAGES.happy;
  img.alt = `Cloud Puppy mascot (${mood})`;

  imgWrap.appendChild(img);

  // Click interaction: play cute chirp, wiggle, cycle quote, trigger confetti if celebrating
  imgWrap.addEventListener('click', () => {
    playPuppyChirp();

    // Trigger wiggle animation
    imgWrap.style.animation = 'none';
    imgWrap.offsetHeight; // trigger reflow
    imgWrap.style.animation = 'earWiggle 0.5s ease-in-out, mascotBounce 2.4s ease-in-out infinite 0.5s';

    // Pick a new quote
    const nextQuote = quotesList[Math.floor(Math.random() * quotesList.length)];
    bubble.textContent = nextQuote;

    if (mood === 'celebrate' || Math.random() < 0.25) {
      firePastelConfetti();
    }
  });

  container.appendChild(bubble);
  container.appendChild(imgWrap);

  return container;
}
