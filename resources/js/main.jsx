import React from 'react';
import { createRoot } from 'react-dom/client';
import Welcome from './Pages/Welcome';
import '../css/app.css';

const container = document.getElementById('root');
if (container) {
    const root = createRoot(container);
    root.render(<Welcome />);
}
