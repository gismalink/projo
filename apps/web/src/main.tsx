import React from 'react';
import ReactDOM from 'react-dom/client';
import { App } from './pages/App';
import './styles/global.scss';
import './styles/personnel.scss';
import './styles/roles.scss';
import './styles/timeline.scss';
import './styles/modals.scss';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
