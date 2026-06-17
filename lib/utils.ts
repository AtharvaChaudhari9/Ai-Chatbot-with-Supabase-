/**
 * Chunks a text string into smaller pieces with a specified size and overlap.
 */
export function chunkText(text: string, size = 1000, overlap = 200): string[] {
  if (size <= 0) return [text];
  
  // Clean up carriage returns
  const cleanText = text.replace(/\r\n/g, '\n');
  const chunks: string[] = [];
  let i = 0;
  
  while (i < cleanText.length) {
    const chunk = cleanText.slice(i, i + size);
    if (chunk.trim()) {
      chunks.push(chunk);
    }
    // Move starting pointer forward
    const step = size - overlap;
    if (step <= 0) {
      // Prevent infinite loop if overlap is larger than size
      break;
    }
    i += step;
  }
  
  return chunks;
}
