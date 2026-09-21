/**
 * Find the next queue index for the player controls.
 * Returning -1 means playback reached the end of the queue.
 */
export function nextQueueIndex({ length, currentIndex, direction = 1, repeat = "off" }) {
  if (!length) return -1;
  if (repeat === "one" && direction === 1) return currentIndex;

  const nextIndex = currentIndex + direction;
  if (nextIndex >= 0 && nextIndex < length) return nextIndex;
  if (repeat === "all") return direction === 1 ? 0 : length - 1;
  return -1;
}

/** Find the song worth preparing for a manual or automatic queue advance. */
export function nextPreparationIndex({ length, currentIndex, repeat = "off" }) {
  const preparationRepeat = repeat === "all" ? "all" : "off";
  return nextQueueIndex({ length, currentIndex, repeat: preparationRepeat });
}

/** Return a shuffled copy without changing the original song list. */
export function shuffledCopy(items, random = Math.random) {
  const shuffled = [...items];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const randomIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[randomIndex]] = [shuffled[randomIndex], shuffled[index]];
  }
  return shuffled;
}
