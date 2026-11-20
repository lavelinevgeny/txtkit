export function encodeBytes(bytes: Uint8Array): string {
  // Each complete chunk is divisible by three, so padding occurs only at the end.
  const chunks: string[] = []
  const chunkSize = 3 * 8192
  for (let from = 0; from < bytes.length; from += chunkSize) {
    chunks.push(btoa(String.fromCharCode(...bytes.subarray(from, from + chunkSize))))
  }
  return chunks.join('')
}
