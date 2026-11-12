// Original site ships precompiled Tailwind v4 CSS (src/styles/original.css); we reuse it verbatim
// for exact fidelity, so no Tailwind v3 pass runs here (it would reorder/override v4 variants).
export default { plugins: { autoprefixer: {} } }
