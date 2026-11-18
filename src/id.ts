let counter = 0

/**
 * Generates a short id that is unique within a document in practice.
 * Not cryptographically random; ids only need to avoid collisions between
 * blocks created in the same document.
 */
export function createId(prefix = ''): string {
  counter = (counter + 1) % 1296
  const time = Date.now().toString(36).slice(-5)
  const rand = Math.floor(Math.random() * 36 ** 4).toString(36).padStart(4, '0')
  return `${prefix}${time}${rand}${counter.toString(36).padStart(2, '0')}`
}
