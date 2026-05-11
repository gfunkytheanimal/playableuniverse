export function setupInput(target, camera) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;

  target.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    target.setPointerCapture(e.pointerId);
  });
  target.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - lastX) / target.clientWidth;
    const dy = (e.clientY - lastY) / target.clientHeight;
    lastX = e.clientX;
    lastY = e.clientY;
    camera.nudgeRotation(-dx * 2.4, -dy * 1.6);
  });
  const release = (e) => {
    if (!dragging) return;
    dragging = false;
    try { target.releasePointerCapture(e.pointerId); } catch (_) {}
  };
  target.addEventListener('pointerup', release);
  target.addEventListener('pointercancel', release);
  target.addEventListener('pointerleave', release);

  target.addEventListener('wheel', (e) => {
    e.preventDefault();
    camera.nudgeZoom(-Math.sign(e.deltaY) * 0.045);
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Digit1') camera.setTargetZoom(0.08);
    else if (e.code === 'Digit2') camera.setTargetZoom(0.5);
    else if (e.code === 'Digit3') camera.setTargetZoom(0.9);
  });
}
