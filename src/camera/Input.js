export function setupInput(target, camera) {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  const mark = () => camera.markInteraction(performance.now() / 1000);

  target.addEventListener('pointerdown', (e) => {
    if (e.button !== 0) return;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    target.setPointerCapture(e.pointerId);
    mark();
  });
  target.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = (e.clientX - lastX) / target.clientWidth;
    const dy = (e.clientY - lastY) / target.clientHeight;
    lastX = e.clientX;
    lastY = e.clientY;
    camera.nudgeRotation(-dx * 1.3, -dy * 0.9);
    mark();
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
    camera.nudgeZoom(-Math.sign(e.deltaY) * 0.075);
    mark();
  }, { passive: false });

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    if (e.code === 'Digit1') { camera.setTargetZoom(0.08); mark(); }
    else if (e.code === 'Digit2') { camera.setTargetZoom(0.5); mark(); }
    else if (e.code === 'Digit3') { camera.setTargetZoom(0.9); mark(); }
  });
}
