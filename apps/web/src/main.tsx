import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './pages/App';
import './styles/global.css';
import './styles/personnel.css';
import './styles/roles.css';
import './styles/timeline.css';
import './styles/modals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
