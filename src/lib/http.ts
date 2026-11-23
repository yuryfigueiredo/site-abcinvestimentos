export async function cancelResponseBody(response: Response): Promise<void> {
  if (!response.body || response.body.locked) return;
  try {
    await response.body.cancel();
  } catch {
    // An aborted or already errored body is already cleaned up.
  }
}

export async function readBoundedText(response: Response, maxBytes: number, label: string): Promise<string> {
  const declaredLength = Number(response.headers.get('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw new Error(`${label} exceeds the maximum response size`);
  }
  if (!response.body) return '';

  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { fatal: true });
  const chunks: string[] = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new Error(`${label} exceeds the maximum response size`);
      chunks.push(decoder.decode(value, { stream: true }));
    }
    chunks.push(decoder.decode());
  } finally {
    reader.releaseLock();
    await cancelResponseBody(response);
  }
  return chunks.join('');
}
