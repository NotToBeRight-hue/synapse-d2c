import React from 'react';
import {createRoot} from 'react-dom/client';
import {InformationPage} from './components/InformationPage';
createRoot(document.getElementById('root')).render(<React.StrictMode><InformationPage page={window.location.pathname.includes('establishment') ? 'establishment' : 'terms'} /></React.StrictMode>);
