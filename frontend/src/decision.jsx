import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import DecisionWorkspace from './components/DecisionWorkspace';

createRoot(document.getElementById('root')).render(<React.StrictMode><App decisionPage WorkspaceView={DecisionWorkspace} /></React.StrictMode>);
