export const HIT_WINDOW = .18;
export function timingGrade(delta) {
  const distance = Math.abs(delta);
  return distance <= .065 ? 'PERFECT' : distance <= HIT_WINDOW ? 'GOOD' : null;
}
export function carouselDistance(index, selected, count) {
  return ((index - selected + count + Math.floor(count / 2)) % count) - Math.floor(count / 2);
}
export function wrapIndex(index, count) { return (index + count) % count; }
export function holdReleaseIsValid(time, end) { return time >= end - .1; }
