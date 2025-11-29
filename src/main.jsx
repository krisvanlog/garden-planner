import React from 'react'
import ReactDOM from 'react-dom/client'
import GardenPlanner from './App.jsx'

const style = document.createElement('style');
style.textContent = `
  @import url('https://cdn.tailwindcss.com');
`;
document.head.appendChild(style);
const script = document.createElement('script');
script.src = "https://cdn.tailwindcss.com";
document.head.appendChild(script);

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GardenPlanner />
  </React.StrictMode>,
)
