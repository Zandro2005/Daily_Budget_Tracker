// ====================================================================
// CLOUDY BUDGET - CONFETTI CELEBRATION HELPER
// ====================================================================

import confetti from 'canvas-confetti';

export function firePastelConfetti() {
  try {
    const count = 75;
    const defaults = {
      origin: { y: 0.7 },
      colors: ['#7EC1F1', '#FFB7D2', '#9CE3C0', '#FFE58F', '#DDD6FE', '#FFFFFF'],
      disableForReducedMotion: true,
    };

    function fire(particleRatio, opts) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio),
      });
    }

    fire(0.25, {
      spread: 26,
      startVelocity: 55,
    });
    fire(0.2, {
      spread: 60,
    });
    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.9,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
    });
    fire(0.1, {
      spread: 120,
      startVelocity: 45,
    });
  } catch (err) {
    console.warn('Confetti error:', err);
  }
}
