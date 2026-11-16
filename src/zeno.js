// Zeno, drawn from the ZenMode mark (Albeit, Part III): two ears from the mark's
// corners, a face from the band, two eyes from the dot, a nose from the cut.
// Feelings live on the root as data-feeling; CSS moves ears, lids and mouth.

const FACE = 'M50 5.35Q50 0 55.35 0L94.65 0Q100 0 100 5.35L100 9.04Q100 10.7 101.17 11.87L147.36 58.06Q150 60.7 150 64.43L150 92Q150 100 142 100L112.34 100Q111.3 100 110.57 99.27L103.41 92.11Q100 88.7 100 93.53L100 98Q100 100 98 100L52 100Q50 100 50 98L50 93.53Q50 88.7 46.59 92.11L39.43 99.27Q38.7 100 37.66 100L8 100Q0 100 0 92L0 64.43Q0 60.7 2.64 58.06L48.83 11.87Q50 10.7 50 9.04Z';
const EAR_L = 'M0 8Q0 0 8 0L21.1 0Q38 0 26.05 11.95L11.95 26.05Q0 38 0 21.1Z';
const EAR_R = 'M142 0Q150 0 150 8L150 21.1Q150 38 138.05 26.05L123.95 11.95Q112 0 128.9 0Z';
const NOSE = 'M73.94 66.46Q75 65.4 76.06 66.46L78.94 69.34Q80 70.4 78.94 71.46L76.06 74.34Q75 75.4 73.94 74.34L71.06 71.46Q70 70.4 71.06 69.34Z';

export const SKINS = {
  zen: ['#86E486', '#34AE41', '#0F5F1A'],
  gold: ['#FFE59A', '#FFBE2E', '#C96E00'],
  ember: ['#FFC197', '#FF7C30', '#B43F00'],
  dusk: ['#D3DDCF', '#93A88F', '#4D654A'],
};

let uid = 0;
export function zenoSVG({ feeling = 'pleasant', skin = 'zen', label = 'Zeno' } = {}) {
  const id = 'z' + (++uid);
  const [a, b, c] = SKINS[skin] || SKINS.zen;
  return `<svg class="zeno" viewBox="-14 -20 178 132" data-feeling="${feeling}" data-skin="${skin}" role="img" aria-label="${label}">
  <defs>
    <linearGradient id="${id}g" gradientUnits="userSpaceOnUse" x1="20" y1="0" x2="34" y2="100"><stop offset="0" stop-color="${a}"/><stop offset=".55" stop-color="${b}"/><stop offset="1" stop-color="${c}"/></linearGradient>
    <linearGradient id="${id}e" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="10" y2="44"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="${id}h" gradientUnits="userSpaceOnUse" cx="60" cy="16" r="70"><stop offset="0" stop-color="#fff" stop-opacity=".36"/><stop offset=".55" stop-color="#fff" stop-opacity=".06"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    <radialGradient id="${id}y" cx=".4" cy=".36" r=".72"><stop offset="0" stop-color="#3A4A3D"/><stop offset=".62" stop-color="#0C140D"/><stop offset="1" stop-color="#030503"/></radialGradient>
  </defs>
  <g class="z-body">
    <g class="z-ear z-earL"><path d="${EAR_L}" fill="url(#${id}e)"/><path d="${EAR_L}" fill="url(#${id}h)"/></g>
    <g class="z-ear z-earR"><path d="${EAR_R}" fill="url(#${id}e)"/><path d="${EAR_R}" fill="url(#${id}h)"/></g>
    <path d="${FACE}" fill="url(#${id}g)"/>
    <path d="${FACE}" fill="url(#${id}h)"/>
    <g class="z-eyes">
      <g class="z-eye"><circle cx="48" cy="51" r="7.2" fill="url(#${id}y)"/><circle cx="45.7" cy="48.4" r="2.2" fill="#fff"/></g>
      <g class="z-eye"><circle cx="102" cy="51" r="7.2" fill="url(#${id}y)"/><circle cx="99.7" cy="48.4" r="2.2" fill="#fff"/></g>
    </g>
    <path d="${NOSE}" fill="#0C140D" opacity=".85"/>
    <g class="z-mouths" fill="none" stroke="#0C140D" stroke-width="3.2" stroke-linecap="round">
      <path class="m m-happy" d="M63 80 Q75 91 87 80"/>
      <path class="m m-pleasant" d="M66 82 Q75 87 84 82"/>
      <ellipse class="m m-listening" cx="75" cy="84" rx="4.2" ry="4.6" fill="#0C140D" stroke="none"/>
      <path class="m m-thinking" d="M67 84 L83 82"/>
      <path class="m m-sad" d="M65 87 Q75 79 85 87"/>
    </g>
  </g>
</svg>`;
}

export const MARK_PATH = 'M29.708 0.13C31.07 0.15 32.17 1.27 32.15 2.63L32.03 11.72C32.02 12.36 31.77 12.97 31.33 13.42L13.76 31.44C13.3 31.91 12.66 32.18 11.99 32.18H2.47C1.11 32.18 0 31.07 0 29.71V20.66C0 20 0.26 19.37 0.72 18.91L18.89 0.74C19.36 0.27 20.01 0.01 20.67 0.01L29.708 0.13ZM27.97 20.3C29.53 18.75 32.18 19.85 32.18 22.04V29.72C32.18 31.08 31.08 32.18 29.72 32.18H22.04C19.85 32.18 18.75 29.53 20.3 27.97L24.14 24.14L27.97 20.3ZM16.04 14.11C14.97 14.11 14.11 14.98 14.11 16.04C14.11 17.1 14.97 17.96 16.04 17.96C17.1 17.96 17.96 17.1 17.96 16.04C17.96 14.98 17.1 14.11 16.04 14.11ZM10.14 0C12.34 0 13.44 2.66 11.88 4.21L4.21 11.88C2.66 13.44 0 12.34 0 10.14V2.46C0 1.1 1.1 0 2.46 0H10.14Z';
