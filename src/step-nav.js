/** @param {string} labelEsc HTML-escaped step label */
export function stepNavHtml(labelEsc) {
  return `<nav class="step-nav" aria-label="Progress">
    <button type="button" class="step-arrow" data-step-prev aria-label="Previous step" disabled>
      <svg class="step-arrow-icon" viewBox="0 0 8 10" aria-hidden="true"><path d="M8 0 0 5l8 5V0z"/></svg>
    </button>
    <span class="step-label">${labelEsc}</span>
    <button type="button" class="step-arrow" data-step-next aria-label="Next step" disabled>
      <svg class="step-arrow-icon" viewBox="0 0 8 10" aria-hidden="true"><path d="M0 0l8 5-8 5V0z"/></svg>
    </button>
  </nav>`;
}

/** @param {ParentNode} root @param {{ prev?: boolean; next?: boolean }} state */
export function setStepNavState(root, { prev, next }) {
  const prevBtn = root.querySelector('[data-step-prev]');
  const nextBtn = root.querySelector('[data-step-next]');
  if (prevBtn && prev !== undefined) prevBtn.disabled = !prev;
  if (nextBtn && next !== undefined) nextBtn.disabled = !next;
}
