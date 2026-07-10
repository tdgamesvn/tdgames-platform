
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { WorkspaceProvider } from './services/WorkspaceContext';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    {/* WorkspaceProvider ở root vì các mini-app return sớm trong App.tsx (ngoài nhánh HomeScreen) */}
    <WorkspaceProvider>
      <App />
    </WorkspaceProvider>
  </React.StrictMode>
);
