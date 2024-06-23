// Confetti effect implementation
(function() {
  // Check for prefers-reduced-motion
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (prefersReducedMotion) {
    return;
  }

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  document.body.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;

  const confettis = [];
  const colors = ['#FFC0CB', '#FFD700', '#8A2BE2', '#00FF00', '#FF4500', '#00BFFF'];

  function createConfetti() {
    const x = Math.floor(Math.random() * canvas.width);
    const y = Math.floor(Math.random() * canvas.height);
    const color = colors[Math.floor(Math.random() * colors.length)];
    const size = Math.random() * (15 - 5) + 5;
    const speed = Math.random() * (5 - 2) + 2;
    const angle = Math.random() * 360;
    confettis.push({x, y, color, size, speed, angle});
  }

  function drawConfetti() {
    confettis.forEach((confetti, index) => {
      ctx.beginPath();
      ctx.arc(confetti.x, confetti.y, confetti.size, 0, 2 * Math.PI);
      ctx.fillStyle = confetti.color;
      ctx.fill();

      // Update confetti position
      confetti.y += confetti.speed;
      confetti.x += Math.cos(confetti.angle) * confetti.speed;

      // Remove confetti that are out of the screen
      if (confetti.y > canvas.height) {
        confettis.splice(index, 1);
      }
    });
  }

  function update() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawConfetti();
    requestAnimationFrame(update);
  }

  // Create confettis every 100ms
  setInterval(createConfetti, 100);

  // Stop creating confettis after 5 seconds
  setTimeout(() => {
    clearInterval(createConfetti);
  }, 5000);

  update();
})();
