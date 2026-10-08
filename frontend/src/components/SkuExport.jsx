import React, {useState} from 'react';
import {downloadSkuContribution} from '../sku-export';
export default function SkuExport({campaigns = [], snapshot = null}) {
  const [error, setError] = useState('');
  function exportJSON() {
    try {setError(''); downloadSkuContribution(campaigns, snapshot);}
    catch {setError('JSON export failed. Please try again.');}
  }
  return <div className="allocation-export"><button type="button" className="button" disabled={!campaigns.length} onClick={exportJSON}>Export JSON</button>{error && <p className="notice error" role="alert">{error}</p>}</div>;
}
