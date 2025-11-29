#!/bin/bash

# Garden Planner v2.0 - Enhanced Edition
# Features:
# - Delete confirmation dialogs for photos/markers/projects
# - Timestamped journal entries per marker
# - Photos with journal entries
# - Full-screen photo viewing
# - Plant auto-lookup via Perenual API

# Define target directory
BASE_DIR="/docker/garden-planner"

echo "🌱 Garden Planner v2.0 - Enhanced Edition"
echo "=========================================="
echo ""
echo "Creating directory structure at $BASE_DIR..."
mkdir -p "$BASE_DIR/src"
mkdir -p "$BASE_DIR/garden_data"

# Navigate to directory
cd "$BASE_DIR"

echo "Generating package.json..."
cat <<'EOF' > package.json
{
  "name": "garden-planner",
  "private": true,
  "version": "2.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "lucide-react": "^0.263.1",
    "react": "^18.2.0",
    "react-dom": "^18.2.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.0.3",
    "vite": "^4.4.5"
  }
}
EOF

echo "Generating vite.config.js..."
cat <<'EOF' > vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': 'http://localhost:80'
    }
  }
})
EOF

echo "Generating Dockerfile..."
cat <<'EOF' > Dockerfile
FROM node:18-alpine
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm install

# Copy source and build
COPY . .
RUN npm run build

# Expose port 80
EXPOSE 80

# Start the server
CMD ["npm", "start"]
EOF

echo "Generating docker-compose.yml..."
cat <<'EOF' > docker-compose.yml
services:
  garden-planner:
    build: .
    container_name: garden-planner
    ports:
      - "8090:80"
    volumes:
      - ./garden_data:/app/data
    restart: unless-stopped
EOF

echo "Generating server.js with plant API proxy..."
cat <<'EOF' > server.js
import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 80;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'garden-data.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

// High limit for photos
app.use(express.json({ limit: '200mb' }));
app.use(express.static(path.join(__dirname, 'dist')));

const initData = async () => {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
};
initData();

// Get projects
app.get('/api/projects', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.json([]);
  }
});

// Save projects
app.post('/api/projects', async (req, res) => {
  try {
    await fs.writeFile(DATA_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Save failed:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

// Get config (API keys)
app.get('/api/config', async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) {
    res.json({ perenualApiKey: '' });
  }
});

// Save config
app.post('/api/config', async (req, res) => {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Config save failed:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

// Proxy for Perenual API to avoid CORS issues
app.get('/api/plants/search', async (req, res) => {
  try {
    const { q, key } = req.query;
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    const response = await fetch(`https://perenual.com/api/species-list?key=${key}&q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Plant search failed:', error);
    res.status(500).json({ error: 'Failed to search plants' });
  }
});

// Get plant details
app.get('/api/plants/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { key } = req.query;
    if (!key) {
      return res.status(400).json({ error: 'API key required' });
    }
    const response = await fetch(`https://perenual.com/api/species/details/${id}?key=${key}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Plant details failed:', error);
    res.status(500).json({ error: 'Failed to get plant details' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Garden Planner server running on port ${PORT}`);
});
EOF

echo "Generating index.html..."
cat <<'EOF' > index.html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no" />
    <title>Garden Planner</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Fraunces:wght@600;700&display=swap" rel="stylesheet">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
EOF

echo "Generating src/main.jsx..."
cat <<'EOF' > src/main.jsx
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
EOF

echo "Generating src/App.jsx (Enhanced Version)..."
cat <<'APPEOF' > src/App.jsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus, Image, BookOpen, Trash2, MapPin, Move, List, X, Camera, Save, Edit3, Maximize2, Search, Leaf, ExternalLink, Settings, Clock, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';

// ========== UTILITY FUNCTIONS ==========
const resizeImage = (base64Str, maxWidth = 1920) => {
  return new Promise((resolve) => {
    let img = new window.Image();
    img.src = base64Str;
    img.onload = () => {
      let canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      if (width > maxWidth) {
        height *= maxWidth / width;
        width = maxWidth;
      }
      canvas.width = width;
      canvas.height = height;
      let ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.9));
    };
  });
};

const formatTimestamp = (timestamp) => {
  const date = new Date(timestamp);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
};

// ========== CONFIRMATION DIALOG COMPONENT ==========
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Delete", confirmColor = "red" }) => {
  if (!isOpen) return null;
  
  const colorClasses = {
    red: "bg-red-600 hover:bg-red-700",
    yellow: "bg-yellow-600 hover:bg-yellow-700",
    green: "bg-emerald-600 hover:bg-emerald-700"
  };
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-red-900/30 rounded-full">
            <AlertTriangle className="w-6 h-6 text-red-400" />
          </div>
          <h3 className="text-xl font-bold text-white">{title}</h3>
        </div>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-3 ${colorClasses[confirmColor]} rounded-xl font-semibold transition-colors`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

// ========== PLANT SEARCH COMPONENT ==========
const PlantSearch = ({ value, onChange, onSelectPlant, apiKey }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlants = useCallback(async (query) => {
    if (!query || query.length < 2 || !apiKey) {
      setSearchResults([]);
      return;
    }
    
    setIsSearching(true);
    try {
      const response = await fetch(`/api/plants/search?q=${encodeURIComponent(query)}&key=${apiKey}`);
      const data = await response.json();
      if (data.data) {
        setSearchResults(data.data.slice(0, 8));
        setShowResults(true);
      }
    } catch (error) {
      console.error('Plant search error:', error);
    } finally {
      setIsSearching(false);
    }
  }, [apiKey]);

  const handleInputChange = (e) => {
    const newValue = e.target.value;
    onChange(newValue);
    
    if (searchTimeout.current) {
      clearTimeout(searchTimeout.current);
    }
    
    searchTimeout.current = setTimeout(() => {
      searchPlants(newValue);
    }, 400);
  };

  const handleSelectPlant = (plant) => {
    onChange(plant.common_name || plant.scientific_name?.[0] || '');
    onSelectPlant(plant);
    setShowResults(false);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input
          type="text"
          value={value}
          onChange={handleInputChange}
          onFocus={() => searchResults.length > 0 && setShowResults(true)}
          className="w-full p-3 pl-10 bg-gray-900 rounded-xl text-white border border-gray-700 focus:border-emerald-500 focus:outline-none"
          placeholder="Search plant name..."
        />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        {isSearching && (
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>
      
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-64 overflow-y-auto">
          {searchResults.map((plant) => (
            <button
              key={plant.id}
              onClick={() => handleSelectPlant(plant)}
              className="w-full p-3 text-left hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700/50 last:border-0 transition-colors"
            >
              {plant.default_image?.small_url ? (
                <img src={plant.default_image.small_url} alt="" className="w-10 h-10 rounded-lg object-cover bg-gray-900" />
              ) : (
                <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center">
                  <Leaf className="w-5 h-5 text-emerald-600" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <div className="font-medium text-white truncate">{plant.common_name || 'Unknown'}</div>
                <div className="text-sm text-gray-400 truncate italic">{plant.scientific_name?.[0]}</div>
              </div>
            </button>
          ))}
        </div>
      )}
      
      {!apiKey && (
        <p className="text-xs text-yellow-500 mt-1 flex items-center gap-1">
          <Settings className="w-3 h-3" /> Add Perenual API key in settings for plant lookup
        </p>
      )}
    </div>
  );
};

// ========== JOURNAL ENTRY COMPONENT ==========
const JournalEntry = ({ entry, onDelete, onViewPhoto }) => {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  
  return (
    <>
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
        <div 
          className="p-4 cursor-pointer"
          onClick={() => setExpanded(!expanded)}
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {formatTimestamp(entry.timestamp)}
            </div>
            {expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}
          </div>
          <p className={`text-gray-200 ${!expanded && 'line-clamp-2'}`}>{entry.text}</p>
        </div>
        
        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            {entry.photos && entry.photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {entry.photos.map((photo, idx) => (
                  <div 
                    key={idx} 
                    className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-gray-900"
                    onClick={(e) => { e.stopPropagation(); onViewPhoto(photo); }}
                  >
                    <img src={photo} alt="" className="w-full h-full object-cover hover:scale-105 transition-transform" />
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }}
              className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"
            >
              <Trash2 className="w-3 h-3" /> Delete entry
            </button>
          </div>
        )}
      </div>
      
      <ConfirmDialog
        isOpen={showDeleteConfirm}
        title="Delete Entry?"
        message="This journal entry will be permanently deleted."
        onConfirm={() => { onDelete(entry.id); setShowDeleteConfirm(false); }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </>
  );
};

// ========== SETTINGS PANEL ==========
const SettingsPanel = ({ isOpen, onClose, apiKey, onApiKeyChange }) => {
  const [key, setKey] = useState(apiKey);
  
  useEffect(() => {
    setKey(apiKey);
  }, [apiKey]);
  
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="w-5 h-5 text-emerald-400" /> Settings
          </h3>
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-full transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>
        
        <div className="space-y-4">
          <div>
            <label className="text-sm font-semibold text-gray-300 block mb-2">
              Perenual API Key
            </label>
            <input
              type="text"
              value={key}
              onChange={(e) => setKey(e.target.value)}
              className="w-full p-3 bg-gray-900 rounded-xl text-white border border-gray-700 focus:border-emerald-500 focus:outline-none font-mono text-sm"
              placeholder="Enter your API key..."
            />
            <p className="text-xs text-gray-500 mt-2">
              Get a free API key at{' '}
              <a href="https://perenual.com/docs/api" target="_blank" rel="noopener noreferrer" className="text-emerald-400 hover:underline">
                perenual.com
              </a>
              {' '}(100 requests/day free)
            </p>
          </div>
        </div>
        
        <button
          onClick={() => { onApiKeyChange(key); onClose(); }}
          className="w-full mt-6 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-colors flex items-center justify-center gap-2"
        >
          <Save className="w-5 h-5" /> Save Settings
        </button>
      </div>
    </div>
  );
};

// ========== MAIN COMPONENT ==========
const GardenPlanner = () => {
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [markers, setMarkers] = useState([]);
  const [tool, setTool] = useState('marker'); 
  const [selectedItem, setSelectedItem] = useState(null);
  
  // Config state
  const [apiKey, setApiKey] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  
  // Dialog & Feature State
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteDescription, setNoteDescription] = useState('');
  const [notePhotos, setNotePhotos] = useState([]);
  const [markerJournalEntries, setMarkerJournalEntries] = useState([]);
  const [linkedPlant, setLinkedPlant] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [newJournalText, setNewJournalText] = useState('');
  const [newJournalPhotos, setNewJournalPhotos] = useState([]);

  // Confirmation dialogs
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [showDeleteMarkerConfirm, setShowDeleteMarkerConfirm] = useState(false);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);

  // Mobile UI States
  const [showSidebar, setShowSidebar] = useState(false);
  const [showGlobalJournal, setShowGlobalJournal] = useState(false);
  const [globalJournalEntries, setGlobalJournalEntries] = useState([]);
  const [newGlobalEntry, setNewGlobalEntry] = useState('');
  const [newGlobalPhotos, setNewGlobalPhotos] = useState([]);
  
  // Transform State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
   
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const journalPhotoInputRef = useRef(null);
  const globalJournalPhotoInputRef = useRef(null);

  // Load data and config on mount
  useEffect(() => { 
    loadData(); 
    loadConfig();
  }, []);

  // Save when data changes
  useEffect(() => {
    if (currentProject) saveData();
  }, [markers, globalJournalEntries, currentProject]);

  const loadConfig = async () => {
    try {
      const response = await fetch('/api/config');
      if (response.ok) {
        const config = await response.json();
        setApiKey(config.perenualApiKey || '');
      }
    } catch (error) {
      console.log('Error loading config:', error);
    }
  };

  const saveConfig = async (key) => {
    setApiKey(key);
    try {
      await fetch('/api/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ perenualApiKey: key }),
      });
    } catch (error) {
      console.error('Error saving config:', error);
    }
  };

  const loadData = async () => {
    try {
      const response = await fetch('/api/projects');
      if (response.ok) {
        const loadedProjects = await response.json();
        setProjects(loadedProjects);
        if (loadedProjects.length > 0) loadProject(loadedProjects[0]);
      }
    } catch (error) { console.log('Error loading projects:', error); }
  };

  const saveData = async () => {
    const updatedProjects = projects.map(p => 
      p.id === currentProject?.id ? { ...currentProject, markers, globalJournalEntries } : p
    );
    setProjects(updatedProjects);
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProjects),
      });
    } catch (error) { console.error('Error saving:', error); }
  };

  const loadProject = (project) => {
    setCurrentProject(project);
    setMarkers(project.markers || []);
    setGlobalJournalEntries(project.globalJournalEntries || []);
    setScale(1);
    setPan({ x: 0, y: 0 });
  };

  const handleImageUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const resizedImage = await resizeImage(event.target.result, 1920);
        const newProject = {
          id: Date.now(),
          name: file.name.replace(/\.[^/.]+$/, ''),
          image: resizedImage, 
          markers: [], 
          globalJournalEntries: []
        };
        const updatedProjects = [...projects, newProject];
        setProjects(updatedProjects);
        loadProject(newProject);
        try {
          await fetch('/api/projects', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(updatedProjects),
          });
        } catch (e) { console.error(e); }
      };
      reader.readAsDataURL(file);
    }
  };

  const deleteCurrentProject = async () => {
    if (!currentProject) return;
    const updatedProjects = projects.filter(p => p.id !== currentProject.id);
    setProjects(updatedProjects);
    try {
      await fetch('/api/projects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedProjects),
      });
    } catch (e) { console.error(e); }
    if (updatedProjects.length > 0) loadProject(updatedProjects[updatedProjects.length - 1]);
    else setCurrentProject(null);
    setShowDeleteProjectConfirm(false);
  };

  // Canvas interactions
  const handleCanvasClick = (e) => {
    if (!currentProject || tool === 'pan') return;
    
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;

    if (tool === 'marker') {
      const newMarker = {
        id: Date.now(), x, y,
        label: `Plant ${markers.length + 1}`,
        description: '', 
        photos: [], 
        journalEntries: [],
        linkedPlant: null,
        color: '#10b981'
      };
      setMarkers([...markers, newMarker]);
      openMarkerDialog(newMarker);
    }
  };

  const handleCanvasMouseDown = (e) => {
    if (tool === 'pan') {
      setIsPanning(true);
      setPanStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };

  const handleCanvasMouseMove = (e) => {
    if (isPanning && tool === 'pan') {
      setPan({ x: e.clientX - panStart.x, y: e.clientY - panStart.y });
    }
  };

  const handleZoom = (delta) => {
    setScale(prev => Math.max(0.2, Math.min(5, prev + delta)));
  };

  // Marker dialog functions
  const openMarkerDialog = (marker) => {
    setSelectedItem(marker);
    setNoteText(marker.label);
    setNoteDescription(marker.description || '');
    setNotePhotos(marker.photos || []);
    setMarkerJournalEntries(marker.journalEntries || []);
    setLinkedPlant(marker.linkedPlant || null);
    setNewJournalText('');
    setNewJournalPhotos([]);
    setShowNoteDialog(true);
  };

  const saveMarkerDetails = () => {
    setMarkers(markers.map(m => m.id === selectedItem.id ? { 
      ...m, 
      label: noteText, 
      description: noteDescription, 
      photos: notePhotos,
      journalEntries: markerJournalEntries,
      linkedPlant: linkedPlant
    } : m));
    setShowNoteDialog(false);
    setSelectedItem(null);
  };

  const deleteMarker = () => {
    setMarkers(markers.filter(m => m.id !== selectedItem.id));
    setShowNoteDialog(false);
    setSelectedItem(null);
    setShowDeleteMarkerConfirm(false);
  };

  // Photo handling with confirmation
  const handleMarkerPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const resized = await resizeImage(event.target.result, 1200);
        setNotePhotos([...notePhotos, resized]);
      };
      reader.readAsDataURL(file);
    }
  };

  const confirmRemovePhoto = (index) => {
    setPhotoToDelete({ type: 'marker', index });
  };

  const executeRemovePhoto = () => {
    if (!photoToDelete) return;
    
    if (photoToDelete.type === 'marker') {
      const newPhotos = [...notePhotos];
      newPhotos.splice(photoToDelete.index, 1);
      setNotePhotos(newPhotos);
    } else if (photoToDelete.type === 'journal') {
      const newPhotos = [...newJournalPhotos];
      newPhotos.splice(photoToDelete.index, 1);
      setNewJournalPhotos(newPhotos);
    } else if (photoToDelete.type === 'globalJournal') {
      const newPhotos = [...newGlobalPhotos];
      newPhotos.splice(photoToDelete.index, 1);
      setNewGlobalPhotos(newPhotos);
    }
    setPhotoToDelete(null);
  };

  // Marker journal entries
  const handleJournalPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const resized = await resizeImage(event.target.result, 1200);
        setNewJournalPhotos([...newJournalPhotos, resized]);
      };
      reader.readAsDataURL(file);
    }
  };

  const addMarkerJournalEntry = () => {
    if (!newJournalText.trim() && newJournalPhotos.length === 0) return;
    
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      text: newJournalText,
      photos: newJournalPhotos
    };
    
    setMarkerJournalEntries([entry, ...markerJournalEntries]);
    setNewJournalText('');
    setNewJournalPhotos([]);
  };

  const deleteMarkerJournalEntry = (entryId) => {
    setMarkerJournalEntries(markerJournalEntries.filter(e => e.id !== entryId));
  };

  // Global journal entries
  const handleGlobalJournalPhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = async (event) => {
        const resized = await resizeImage(event.target.result, 1200);
        setNewGlobalPhotos([...newGlobalPhotos, resized]);
      };
      reader.readAsDataURL(file);
    }
  };

  const addGlobalJournalEntry = () => {
    if (!newGlobalEntry.trim() && newGlobalPhotos.length === 0) return;
    
    const entry = {
      id: Date.now(),
      timestamp: Date.now(),
      text: newGlobalEntry,
      photos: newGlobalPhotos
    };
    
    setGlobalJournalEntries([entry, ...globalJournalEntries]);
    setNewGlobalEntry('');
    setNewGlobalPhotos([]);
  };

  const deleteGlobalJournalEntry = (entryId) => {
    setGlobalJournalEntries(globalJournalEntries.filter(e => e.id !== entryId));
  };

  // Canvas rendering
  useEffect(() => {
    if (!currentProject || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    if (!img || !img.complete) return;
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const MARKER_RADIUS = 8;
    const LABEL_PADDING = 6;
    
    markers.forEach(marker => {
      // Marker dot with glow
      ctx.shadowColor = marker.color;
      ctx.shadowBlur = 12;
      ctx.fillStyle = marker.color;
      ctx.beginPath();
      ctx.arc(marker.x, marker.y, MARKER_RADIUS, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
      
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 3;
      ctx.stroke();
      
      // Label
      ctx.font = 'bold 18px "DM Sans", sans-serif'; 
      const textMetrics = ctx.measureText(marker.label);
      const boxWidth = textMetrics.width + (LABEL_PADDING * 2);
      const boxHeight = 26;
      
      let labelX = marker.x + 14;
      let labelY = marker.y - 13;
      
      if (labelX + boxWidth > canvas.width) labelX = marker.x - 14 - boxWidth;
      
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)';
      ctx.beginPath();
      ctx.roundRect(labelX, labelY, boxWidth, boxHeight, 6);
      ctx.fill();
      
      ctx.fillStyle = '#fff';
      ctx.textBaseline = 'middle';
      ctx.fillText(marker.label, labelX + LABEL_PADDING, labelY + (boxHeight / 2));
    });
  }, [markers, currentProject]);

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden select-none" style={{ fontFamily: '"DM Sans", sans-serif' }}>
      {/* Header */}
      <div className="bg-gray-900/95 backdrop-blur border-b border-gray-800 p-3 flex items-center justify-between z-20 shrink-0">
        <div className="flex items-center gap-2">
          <Leaf className="w-6 h-6 text-emerald-400" />
          <h1 className="text-lg font-bold text-emerald-400 truncate max-w-[140px]" style={{ fontFamily: '"Fraunces", serif' }}>
            {currentProject ? currentProject.name : 'Garden Planner'}
          </h1>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <Settings className="w-5 h-5 text-gray-400" />
          </button>
          <button onClick={() => fileInputRef.current?.click()} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors">
            <Image className="w-5 h-5 text-gray-300" />
          </button>
          {currentProject && (
            <>
              <button onClick={() => setShowDeleteProjectConfirm(true)} className="p-2 bg-red-950/50 hover:bg-red-900/50 rounded-xl text-red-400 border border-red-900/30 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
              <button onClick={() => { setShowSidebar(!showSidebar); setShowGlobalJournal(false); }} className={`p-2 rounded-xl transition-colors ${showSidebar ? 'bg-emerald-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                <List className="w-5 h-5" />
              </button>
              <button onClick={() => { setShowGlobalJournal(!showGlobalJournal); setShowSidebar(false); }} className={`p-2 rounded-xl transition-colors ${showGlobalJournal ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}>
                <BookOpen className="w-5 h-5" />
              </button>
            </>
          )}
        </div>
      </div>
      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />

      {/* Main Area */}
      <div className="flex-1 relative flex overflow-hidden">
        <div className="flex-1 relative bg-gray-950 overflow-hidden touch-none">
          {currentProject ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className="relative transition-transform duration-75 origin-center pointer-events-auto" 
                  style={{ 
                    transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`,
                    willChange: 'transform'
                  }}
                >
                  <img ref={imageRef} src={currentProject.image} className="block pointer-events-none" 
                    onLoad={() => {
                      if (canvasRef.current && imageRef.current) {
                        canvasRef.current.width = imageRef.current.naturalWidth;
                        canvasRef.current.height = imageRef.current.naturalHeight;
                        canvasRef.current.style.width = imageRef.current.width + 'px';
                        canvasRef.current.style.height = imageRef.current.height + 'px';
                      }
                    }} 
                  />
                  <canvas 
                    ref={canvasRef} 
                    className="absolute top-0 left-0"
                    onClick={handleCanvasClick}
                    onMouseDown={handleCanvasMouseDown}
                    onMouseMove={handleCanvasMouseMove}
                    onMouseUp={() => setIsPanning(false)}
                    onMouseLeave={() => setIsPanning(false)}
                    onTouchStart={(e) => {
                       const touch = e.touches[0];
                       handleCanvasMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
                    }}
                    onTouchMove={(e) => {
                       const touch = e.touches[0];
                       handleCanvasMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
                    }}
                    onTouchEnd={() => setIsPanning(false)}
                  />
                </div>
              </div>

              {/* Floating Toolbar */}
              <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-gray-900/95 backdrop-blur p-2 rounded-2xl shadow-2xl border border-gray-800 z-10 pointer-events-auto">
                <button onClick={() => setTool('pan')} className={`p-3.5 rounded-xl transition-all ${tool === 'pan' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                  <Move className="w-6 h-6" />
                </button>
                <button onClick={() => setTool('marker')} className={`p-3.5 rounded-xl transition-all ${tool === 'marker' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}>
                  <MapPin className="w-6 h-6" />
                </button>
              </div>

              {/* Zoom Buttons */}
              <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-10 pointer-events-auto">
                <button onClick={() => handleZoom(0.5)} className="p-3 bg-gray-900/95 backdrop-blur rounded-xl shadow-lg border border-gray-800 text-white hover:bg-gray-800 transition-colors">
                  <Plus className="w-5 h-5" />
                </button>
                <button onClick={() => handleZoom(-0.5)} className="p-3 bg-gray-900/95 backdrop-blur rounded-xl shadow-lg border border-gray-800 text-white hover:bg-gray-800 transition-colors">
                  <Minus className="w-5 h-5" />
                </button>
              </div>

              <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur px-3 py-2 rounded-xl text-xs font-medium pointer-events-auto border border-gray-800 hover:bg-gray-800 transition-colors">
                Reset View
              </button>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gray-900 flex items-center justify-center mb-6 border border-gray-800">
                  <Leaf className="w-10 h-10 text-emerald-600" />
                </div>
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: '"Fraunces", serif' }}>Welcome to Garden Planner</h2>
                <p className="text-gray-500 mb-6 max-w-xs">Upload a garden layout or floorplan image to start mapping your plants</p>
                <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-colors flex items-center gap-2">
                  <Image className="w-5 h-5" /> Upload Image
                </button>
             </div>
          )}
        </div>
        
        {/* SIDEBAR - Markers List */}
        {showSidebar && (
          <div className="absolute inset-0 bg-gray-950/98 z-30 p-4 overflow-y-auto backdrop-blur md:relative md:w-80 md:bg-gray-900/50 md:backdrop-blur-none md:border-l md:border-gray-800">
            <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold text-emerald-400" style={{ fontFamily: '"Fraunces", serif' }}>Plants & Markers</h2>
               <button onClick={() => setShowSidebar(false)} className="md:hidden p-2 hover:bg-gray-800 rounded-xl"><X className="w-6 h-6" /></button>
            </div>
            <div className="space-y-2">
              {markers.map(marker => (
                <div key={marker.id} className="p-4 bg-gray-800/50 rounded-xl flex justify-between items-center border border-gray-700/50 hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => { openMarkerDialog(marker); setShowSidebar(false); }}>
                  <span className="flex items-center gap-3 font-medium">
                    <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: marker.color, boxShadow: `0 0 12px ${marker.color}40` }} />
                    <div>
                      <div className="text-white">{marker.label}</div>
                      {marker.linkedPlant && (
                        <div className="text-xs text-gray-500 italic">{marker.linkedPlant.scientific_name?.[0]}</div>
                      )}
                    </div>
                  </span>
                  <Edit3 className="w-4 h-4 text-gray-500" />
                </div>
              ))}
              {markers.length === 0 && (
                <div className="text-center py-12">
                  <MapPin className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">No markers yet</p>
                  <p className="text-gray-600 text-sm">Tap the map to add plants</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* GLOBAL JOURNAL */}
        {showGlobalJournal && (
          <div className="absolute inset-0 bg-gray-950/98 z-30 p-4 overflow-y-auto backdrop-blur md:relative md:w-96 md:bg-gray-900/50 md:backdrop-blur-none md:border-l md:border-gray-800">
             <div className="flex justify-between items-center mb-4">
               <h2 className="text-lg font-bold text-blue-400" style={{ fontFamily: '"Fraunces", serif' }}>Garden Journal</h2>
               <button onClick={() => setShowGlobalJournal(false)} className="md:hidden p-2 hover:bg-gray-800 rounded-xl"><X className="w-6 h-6" /></button>
            </div>
            
            {/* New Entry Form */}
            <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <textarea 
                value={newGlobalEntry} 
                onChange={(e) => setNewGlobalEntry(e.target.value)} 
                placeholder="Write a journal entry..." 
                className="w-full p-3 bg-gray-900 rounded-xl border border-gray-700 h-24 focus:outline-none focus:border-blue-500 resize-none text-sm" 
              />
              
              {newGlobalPhotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {newGlobalPhotos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden">
                      <img src={photo} alt="" className="w-full h-full object-cover" />
                      <button 
                        onClick={() => setPhotoToDelete({ type: 'globalJournal', index: idx })}
                        className="absolute top-1 right-1 bg-red-600 p-1 rounded-full"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="flex gap-2 mt-3">
                <button 
                  onClick={() => globalJournalPhotoInputRef.current?.click()}
                  className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  <Camera className="w-5 h-5 text-gray-300" />
                </button>
                <button 
                  onClick={addGlobalJournalEntry}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors"
                >
                  Add Entry
                </button>
              </div>
              <input ref={globalJournalPhotoInputRef} type="file" accept="image/*" onChange={handleGlobalJournalPhotoUpload} className="hidden" />
            </div>
            
            {/* Entries */}
            <div className="space-y-3">
              {globalJournalEntries.map(entry => (
                <JournalEntry 
                  key={entry.id} 
                  entry={entry} 
                  onDelete={deleteGlobalJournalEntry}
                  onViewPhoto={setViewingImage}
                />
              ))}
              {globalJournalEntries.length === 0 && (
                <div className="text-center py-12">
                  <BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-3" />
                  <p className="text-gray-500">No journal entries yet</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MARKER DETAIL DIALOG */}
      {showNoteDialog && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-2 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-lg border border-gray-800 shadow-2xl flex flex-col max-h-[95vh] my-auto">
            <div className="flex justify-between items-center mb-5 shrink-0">
               <h3 className="text-xl font-bold text-emerald-400" style={{ fontFamily: '"Fraunces", serif' }}>Plant Details</h3>
               <button onClick={() => setShowNoteDialog(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"><X className="w-5 h-5"/></button>
            </div>
            
            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              {/* Plant Name with Search */}
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">Plant Name</label>
                <PlantSearch 
                  value={noteText}
                  onChange={setNoteText}
                  onSelectPlant={(plant) => setLinkedPlant(plant)}
                  apiKey={apiKey}
                />
                {linkedPlant && (
                  <div className="mt-3 p-3 bg-emerald-950/30 rounded-xl border border-emerald-900/30 flex items-center gap-3">
                    {linkedPlant.default_image?.small_url ? (
                      <img src={linkedPlant.default_image.small_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center">
                        <Leaf className="w-6 h-6 text-emerald-600" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-emerald-400 truncate">{linkedPlant.common_name}</div>
                      <div className="text-sm text-gray-400 italic truncate">{linkedPlant.scientific_name?.[0]}</div>
                    </div>
                    <a 
                      href={`https://perenual.com/plant-species-database-search-finder/species/${linkedPlant.id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                  </div>
                )}
              </div>
              
              {/* Notes */}
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">Notes</label>
                <textarea 
                  value={noteDescription} 
                  onChange={(e) => setNoteDescription(e.target.value)} 
                  className="w-full p-3 bg-gray-800 rounded-xl text-white border border-gray-700 focus:border-emerald-500 focus:outline-none h-20 resize-none" 
                  placeholder="Planting date, variety, care notes..." 
                />
              </div>
              
              {/* Photos */}
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">Photos</label>
                <div className="grid grid-cols-3 gap-2">
                  {notePhotos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group cursor-pointer" onClick={() => setViewingImage(photo)}>
                      <img src={photo} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                         <Maximize2 className="w-6 h-6 text-white drop-shadow-lg" />
                      </div>
                      <button 
                        onClick={(e) => { e.stopPropagation(); confirmRemovePhoto(idx); }} 
                        className="absolute top-1.5 right-1.5 bg-red-600 p-1.5 rounded-full text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                  <button onClick={() => photoInputRef.current?.click()} className="aspect-square bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-500 transition-colors">
                    <Camera className="w-6 h-6 mb-1" />
                    <span className="text-xs">Add</span>
                  </button>
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handleMarkerPhotoUpload} className="hidden" />
              </div>
              
              {/* Marker Journal */}
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">
                  <Clock className="w-3 h-3 inline mr-1" /> Journal Entries
                </label>
                
                {/* New entry form */}
                <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 mb-3">
                  <textarea 
                    value={newJournalText} 
                    onChange={(e) => setNewJournalText(e.target.value)} 
                    placeholder="Add a timestamped note..." 
                    className="w-full p-2 bg-gray-900 rounded-lg border border-gray-700 h-16 focus:outline-none focus:border-emerald-500 resize-none text-sm" 
                  />
                  
                  {newJournalPhotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {newJournalPhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden">
                          <img src={photo} alt="" className="w-full h-full object-cover" />
                          <button 
                            onClick={() => setPhotoToDelete({ type: 'journal', index: idx })}
                            className="absolute top-1 right-1 bg-red-600 p-1 rounded-full"
                          >
                            <X className="w-2 h-2" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  
                  <div className="flex gap-2 mt-2">
                    <button 
                      onClick={() => journalPhotoInputRef.current?.click()}
                      className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                    >
                      <Camera className="w-4 h-4 text-gray-300" />
                    </button>
                    <button 
                      onClick={addMarkerJournalEntry}
                      className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold text-sm transition-colors"
                    >
                      Add Entry
                    </button>
                  </div>
                  <input ref={journalPhotoInputRef} type="file" accept="image/*" onChange={handleJournalPhotoUpload} className="hidden" />
                </div>
                
                {/* Entries list */}
                <div className="space-y-2 max-h-48 overflow-y-auto">
                  {markerJournalEntries.map(entry => (
                    <JournalEntry 
                      key={entry.id} 
                      entry={entry} 
                      onDelete={deleteMarkerJournalEntry}
                      onViewPhoto={setViewingImage}
                    />
                  ))}
                </div>
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-800 shrink-0">
              <button onClick={saveMarkerDetails} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors">
                <Save className="w-5 h-5" /> Save
              </button>
              <button onClick={() => setShowDeleteMarkerConfirm(true)} className="px-5 py-3 bg-red-950/50 text-red-400 rounded-xl border border-red-900/30 hover:bg-red-900/50 transition-colors">
                <Trash2 className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL SCREEN IMAGE VIEWER */}
      {viewingImage && (
        <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center p-0" onClick={() => setViewingImage(null)}>
           <img src={viewingImage} className="max-w-full max-h-full object-contain" />
           <button className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur p-3 rounded-xl text-white hover:bg-gray-800 transition-colors">
             <X className="w-6 h-6" />
           </button>
        </div>
      )}

      {/* SETTINGS PANEL */}
      <SettingsPanel 
        isOpen={showSettings}
        onClose={() => setShowSettings(false)}
        apiKey={apiKey}
        onApiKeyChange={saveConfig}
      />

      {/* CONFIRMATION DIALOGS */}
      <ConfirmDialog
        isOpen={photoToDelete !== null}
        title="Delete Photo?"
        message="This photo will be permanently removed."
        onConfirm={executeRemovePhoto}
        onCancel={() => setPhotoToDelete(null)}
      />
      
      <ConfirmDialog
        isOpen={showDeleteMarkerConfirm}
        title="Delete Marker?"
        message="This marker and all its journal entries will be permanently deleted."
        onConfirm={deleteMarker}
        onCancel={() => setShowDeleteMarkerConfirm(false)}
      />
      
      <ConfirmDialog
        isOpen={showDeleteProjectConfirm}
        title="Delete Garden Plan?"
        message="This entire garden plan including all markers and journal entries will be permanently deleted."
        onConfirm={deleteCurrentProject}
        onCancel={() => setShowDeleteProjectConfirm(false)}
      />
    </div>
  );
};

export default GardenPlanner;
APPEOF

echo ""
echo "=========================================="
echo "🌱 All files created successfully!"
echo "=========================================="
echo ""
echo "NEW FEATURES IN v2.0:"
echo "  ✅ Delete confirmation dialogs for photos, markers, and projects"
echo "  ✅ Timestamped journal entries for each plant marker"
echo "  ✅ Ability to add photos to journal entries"
echo "  ✅ Full-screen, full-quality photo viewing"
echo "  ✅ Plant auto-lookup via Perenual API with autocomplete"
echo "  ✅ Links to plant info pages on Perenual"
echo "  ✅ Settings panel for API key configuration"
echo "  ✅ Improved UI with better typography and animations"
echo ""
echo "PLANT LOOKUP SETUP:"
echo "  1. Get a free API key at: https://perenual.com/docs/api"
echo "  2. Click the Settings (gear) icon in the app"
echo "  3. Enter your API key and save"
echo "  4. Now you can search for plants when adding markers!"
echo ""
echo "To deploy the application:"
echo "  cd $BASE_DIR"
echo "  docker compose down"
echo "  docker compose up -d --build"
echo ""
echo "Then access at: http://localhost:8090"
