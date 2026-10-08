import React, { useRef } from 'react';
export default function SourcePanel({ busy = false, onSync = async () => {}, onError = () => {} }) {
  const input = useRef(null);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) { onError('Choose a JSON snapshot smaller than 4 MB.'); return; }
    try { await onSync({ ...JSON.parse(await file.text()), data_mode: 'uploaded' }); }
    catch (error) { onError(error instanceof SyntaxError ? 'The selected file is not valid JSON.' : error.message); }
  }
  return <div className="source-actions">
    <input ref={input} type="file" accept=".json,application/json" onChange={upload} hidden />
    <button className="button" disabled={busy} onClick={() => input.current?.click()}>Import snapshot JSON</button>
  </div>;
}

