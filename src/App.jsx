import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus, Image, BookOpen, Trash2, MapPin, Move, List, X, Camera, Save, Edit3, Maximize2, Search, Leaf, ExternalLink, Settings, Clock, AlertTriangle, ChevronDown, ChevronUp, GripHorizontal, Check, Minimize2, MoreVertical, Upload } from 'lucide-react';

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
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: '2-digit', hour12: true
  });
};

// ========== COMPONENTS ==========
const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmText = "Delete", confirmColor = "red" }) => {
  if (!isOpen) return null;
  const colorClasses = { red: "bg-red-600 hover:bg-red-700", yellow: "bg-yellow-600 hover:bg-yellow-700", green: "bg-emerald-600 hover:bg-emerald-700" };
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[100] backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-sm border border-gray-700 shadow-2xl">
        <div className="flex items-center gap-3 mb-4"><div className="p-2 bg-red-900/30 rounded-full"><AlertTriangle className="w-6 h-6 text-red-400" /></div><h3 className="text-xl font-bold text-white">{title}</h3></div>
        <p className="text-gray-300 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-3 bg-gray-700 hover:bg-gray-600 rounded-xl font-semibold transition-colors">Cancel</button>
          <button onClick={onConfirm} className={`flex-1 py-3 ${colorClasses[confirmColor]} rounded-xl font-semibold transition-colors`}>{confirmText}</button>
        </div>
      </div>
    </div>
  );
};

const PlantSearch = ({ value, onChange, onSelectPlant, perenualKey, trefleToken }) => {
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchTimeout = useRef(null);
  const wrapperRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => { if (wrapperRef.current && !wrapperRef.current.contains(e.target)) setShowResults(false); };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const searchPlants = useCallback(async (query) => {
    if (!query || query.length < 2) { setSearchResults([]); return; }
    setIsSearching(true);
    const allResults = [];
    try {
      try {
        const response = await fetch(`/api/wiki/search?q=${encodeURIComponent(query)}`);
        const data = await response.json();
        if (data.data) {
          const wikiResults = data.data.map(page => ({
            source: 'wikipedia', id: page.pageid, displayName: page.title, scientificName: 'Wikipedia Entry',
            imageUrl: page.thumbnail ? page.thumbnail.source : null, infoUrl: `https://en.wikipedia.org/wiki/${encodeURIComponent(page.title)}`, description: page.extract
          }));
          allResults.push(...wikiResults);
        }
      } catch (e) { console.error(e); }

      if (perenualKey) {
        try {
          const response = await fetch(`/api/plants/search?q=${encodeURIComponent(query)}&key=${perenualKey}`);
          const data = await response.json();
          if (data.data) allResults.push(...data.data.slice(0, 3).map(plant => ({ source: 'perenual', id: plant.id, displayName: plant.common_name || plant.scientific_name?.[0], scientificName: plant.scientific_name?.[0], imageUrl: plant.default_image?.small_url || null, infoUrl: `https://perenual.com/plant-species-database-search-finder/species/${plant.id}` })));
        } catch (e) { console.error(e); }
      }
      setSearchResults(allResults); setShowResults(true);
    } catch (error) { console.error(error); } finally { setIsSearching(false); }
  }, [perenualKey, trefleToken]);

  const handleInputChange = (e) => {
    const newValue = e.target.value; onChange(newValue);
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    searchTimeout.current = setTimeout(() => searchPlants(newValue), 400);
  };

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <input type="text" value={value} onChange={handleInputChange} onFocus={() => searchResults.length > 0 && setShowResults(true)} className="w-full p-3 pl-10 bg-gray-900 rounded-xl text-white border border-gray-700 focus:border-emerald-500 focus:outline-none" placeholder="Search plant name..." />
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
        {isSearching && <div className="absolute right-3 top-1/2 -translate-y-1/2"><div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" /></div>}
      </div>
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-2 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden max-h-72 overflow-y-auto">
          {searchResults.map((plant, idx) => (
            <button key={`${plant.source}-${plant.id}-${idx}`} onClick={() => { onChange(plant.displayName); onSelectPlant(plant); setShowResults(false); }} className="w-full p-3 text-left hover:bg-gray-700 flex items-center gap-3 border-b border-gray-700/50 last:border-0 transition-colors">
              {plant.imageUrl ? <img src={plant.imageUrl} className="w-10 h-10 rounded-lg object-cover bg-gray-900" /> : <div className="w-10 h-10 rounded-lg bg-gray-900 flex items-center justify-center"><Leaf className="w-5 h-5 text-emerald-600" /></div>}
              <div className="flex-1 min-w-0"><div className="font-medium text-white truncate flex items-center gap-2">{plant.displayName} <span className="text-[10px] px-1.5 py-0.5 bg-gray-700 rounded font-medium capitalize">{plant.source}</span></div></div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const JournalEntry = ({ entry, onDelete, onViewPhoto }) => {
  const [expanded, setExpanded] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  return (
    <>
      <div className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden">
        <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
          <div className="flex items-center justify-between mb-2"><div className="flex items-center gap-2 text-xs text-gray-400"><Clock className="w-3 h-3" />{formatTimestamp(entry.timestamp)}</div>{expanded ? <ChevronUp className="w-4 h-4 text-gray-500" /> : <ChevronDown className="w-4 h-4 text-gray-500" />}</div>
          <p className={`text-gray-200 ${!expanded && 'line-clamp-2'}`}>{entry.text}</p>
        </div>
        {expanded && (
          <div className="px-4 pb-4 space-y-3">
            {entry.photos?.length > 0 && <div className="grid grid-cols-3 gap-2">{entry.photos.map((photo, idx) => (<div key={idx} className="aspect-square rounded-lg overflow-hidden cursor-pointer bg-gray-900" onClick={(e) => { e.stopPropagation(); onViewPhoto(photo); }}><img src={photo} className="w-full h-full object-cover" /></div>))}</div>}
            <button onClick={(e) => { e.stopPropagation(); setShowDeleteConfirm(true); }} className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1"><Trash2 className="w-3 h-3" /> Delete entry</button>
          </div>
        )}
      </div>
      <ConfirmDialog isOpen={showDeleteConfirm} title="Delete Entry?" message="Permanently delete?" onConfirm={() => { onDelete(entry.id); setShowDeleteConfirm(false); }} onCancel={() => setShowDeleteConfirm(false)} />
    </>
  );
};

const SettingsPanel = ({ isOpen, onClose, perenualKey, trefleToken, onKeysChange }) => {
  const [pKey, setPKey] = useState(perenualKey);
  const [tToken, setTToken] = useState(trefleToken);
  useEffect(() => { setPKey(perenualKey); setTToken(trefleToken); }, [perenualKey, trefleToken]);
  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center p-4 z-[80] backdrop-blur-sm">
      <div className="bg-gray-800 rounded-2xl p-6 w-full max-w-md border border-gray-700 shadow-2xl">
        <div className="flex justify-between items-center mb-6"><h3 className="text-xl font-bold text-white flex items-center gap-2"><Settings className="w-5 h-5" /> Settings</h3><button onClick={onClose}><X className="w-5 h-5" /></button></div>
        <div className="space-y-4">
          <div className="p-3 bg-gray-700/50 rounded-xl border border-gray-600/30"><p className="text-xs text-gray-300"><strong>Wikipedia</strong> is enabled by default for common veg/fruit lookups.</p></div>
          <div><label className="text-xs text-gray-400 block mb-1">Perenual API Key</label><input type="text" value={pKey} onChange={(e) => setPKey(e.target.value)} className="w-full p-3 bg-gray-900 rounded-xl border border-gray-700" placeholder="Optional..." /></div>
          <div><label className="text-xs text-gray-400 block mb-1">Trefle API Token</label><input type="text" value={tToken} onChange={(e) => setTToken(e.target.value)} className="w-full p-3 bg-gray-900 rounded-xl border border-gray-700" placeholder="Optional..." /></div>
        </div>
        <button onClick={() => { onKeysChange(pKey, tToken); onClose(); }} className="w-full mt-6 py-3 bg-emerald-600 rounded-xl font-bold flex items-center justify-center gap-2"><Save className="w-5 h-5" /> Save</button>
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
  const [perenualKey, setPerenualKey] = useState('');
  const [trefleToken, setTrefleToken] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [showNoteDialog, setShowNoteDialog] = useState(false);
  const [noteText, setNoteText] = useState('');
  const [noteDescription, setNoteDescription] = useState('');
  const [notePhotos, setNotePhotos] = useState([]);
  const [markerJournalEntries, setMarkerJournalEntries] = useState([]);
  const [linkedPlant, setLinkedPlant] = useState(null);
  const [viewingImage, setViewingImage] = useState(null);
  const [newJournalText, setNewJournalText] = useState('');
  const [newJournalPhotos, setNewJournalPhotos] = useState([]);
  const [photoToDelete, setPhotoToDelete] = useState(null);
  const [showDeleteMarkerConfirm, setShowDeleteMarkerConfirm] = useState(false);
  const [showDeleteProjectConfirm, setShowDeleteProjectConfirm] = useState(false);
  const [showSidebar, setShowSidebar] = useState(false);
  const [showGlobalJournal, setShowGlobalJournal] = useState(false);
  const [globalJournalEntries, setGlobalJournalEntries] = useState([]);
  const [newGlobalEntry, setNewGlobalEntry] = useState('');
  const [newGlobalPhotos, setNewGlobalPhotos] = useState([]);
  const [showProjectMenu, setShowProjectMenu] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [showFullNote, setShowFullNote] = useState(false);
  
  // Transform & Drag State
  const [scale, setScale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0 });
  const [relocatingMarker, setRelocatingMarker] = useState(null);
  
  // CRITICAL FIX: Track image loading state
  const [imageLoaded, setImageLoaded] = useState(false);
   
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const fileInputRef = useRef(null);
  const photoInputRef = useRef(null);
  const journalPhotoInputRef = useRef(null);
  const globalJournalPhotoInputRef = useRef(null);
  const menuRef = useRef(null);

  useEffect(() => { loadData(); loadConfig(); }, []);
  useEffect(() => { if (currentProject) saveData(); }, [markers, globalJournalEntries, currentProject]);
  
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setShowProjectMenu(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const loadConfig = async () => { try { const response = await fetch('/api/config'); if (response.ok) { const config = await response.json(); setPerenualKey(config.perenualApiKey || ''); setTrefleToken(config.trefleToken || ''); } } catch (error) { console.log('Error loading config'); } };
  const saveConfig = async (pKey, tToken) => { setPerenualKey(pKey); setTrefleToken(tToken); try { await fetch('/api/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ perenualApiKey: pKey, trefleToken: tToken }) }); } catch (e) {} };
  const loadData = async () => { try { const response = await fetch('/api/projects'); if (response.ok) { const loadedProjects = await response.json(); setProjects(loadedProjects); if (loadedProjects.length > 0) loadProject(loadedProjects[0]); } } catch (error) {} };
  
  const saveData = async () => { 
    const updatedProjects = projects.map(p => p.id === currentProject?.id ? { ...currentProject, markers, globalJournalEntries } : p);
    setProjects(updatedProjects);
    try { 
      const res = await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedProjects) }); 
      if (res.ok) { const data = await res.json(); if (data.data) setProjects(data.data); }
    } catch (e) {} 
  };

  const loadProject = (project) => { 
    setCurrentProject(project); 
    setMarkers(project.markers || []); 
    setGlobalJournalEntries(project.globalJournalEntries || []); 
    setScale(1); 
    setPan({ x: 0, y: 0 }); 
    setRelocatingMarker(null);
    setImageLoaded(false); // Reset image state
  };
  
  const handleImageUpload = (e) => { 
    const file = e.target.files[0]; 
    if (file) { 
        const reader = new FileReader(); 
        reader.onload = async (event) => { 
            const resizedImage = await resizeImage(event.target.result, 1920); 
            const newProject = { id: Date.now(), name: file.name.replace(/\.[^/.]+$/, ''), image: resizedImage, markers: [], globalJournalEntries: [] }; 
            const updatedProjects = [...projects, newProject]; 
            setProjects(updatedProjects); 
            loadProject(newProject); 
            try { await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedProjects) }); } catch (e) {}
        }; 
        reader.readAsDataURL(file); 
    } 
    setShowProjectMenu(false);
  };

  const deleteCurrentProject = async () => {
    if (!currentProject) return;
    const updatedProjects = projects.filter(p => p.id !== currentProject.id);
    setProjects(updatedProjects);
    try { await fetch('/api/projects', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(updatedProjects) }); } catch (e) {}
    if (updatedProjects.length > 0) loadProject(updatedProjects[updatedProjects.length - 1]);
    else setCurrentProject(null);
    setShowDeleteProjectConfirm(false);
    setShowProjectMenu(false);
  };

  const renameProject = () => {
    if (!renameText.trim()) return;
    const updated = { ...currentProject, name: renameText };
    setCurrentProject(updated);
    setProjects(projects.map(p => p.id === updated.id ? updated : p));
    setShowRenameDialog(false);
    setShowProjectMenu(false);
  };

  // Pointer Logic
  const getPointerPos = (e) => {
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return { x: (clientX - rect.left) * scaleX, y: (clientY - rect.top) * scaleY, clientX, clientY };
  };

  const handleStart = (e) => {
    if (!currentProject) return;
    const pos = getPointerPos(e);
    if (relocatingMarker) {
      const dx = relocatingMarker.x - pos.x;
      const dy = relocatingMarker.y - pos.y;
      if (Math.sqrt(dx*dx + dy*dy) > 50) { setIsPanning(true); setPanStart({ x: pos.clientX - pan.x, y: pos.clientY - pan.y }); }
    } else if (tool === 'pan') { setIsPanning(true); setPanStart({ x: pos.clientX - pan.x, y: pos.clientY - pan.y }); }
  };

  const handleMove = (e) => {
    if (!currentProject) return;
    const pos = getPointerPos(e);
    if (relocatingMarker && !isPanning) {
      e.preventDefault();
      const updated = { ...relocatingMarker, x: pos.x, y: pos.y };
      setRelocatingMarker(updated);
      setMarkers(markers.map(m => m.id === updated.id ? updated : m));
    } else if (isPanning) {
      e.preventDefault();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const clientY = e.touches ? e.touches[0].clientY : e.clientY;
      setPan({ x: clientX - panStart.x, y: clientY - panStart.y });
    }
  };

  const handleEnd = () => { setIsPanning(false); };

  const handleCanvasClick = (e) => {
    if (!currentProject) return;
    if (relocatingMarker) return;
    const pos = getPointerPos(e);
    const hitMarker = markers.find(m => { const dx = m.x - pos.x; const dy = m.y - pos.y; return Math.sqrt(dx*dx + dy*dy) < 30; });
    if (hitMarker && tool !== 'pan') openMarkerDialog(hitMarker);
    else if (tool === 'marker' && !hitMarker) {
      const newMarker = { id: Date.now(), x: pos.x, y: pos.y, label: `Plant ${markers.length + 1}`, description: '', photos: [], journalEntries: [], linkedPlant: null, color: '#10b981' };
      setMarkers([...markers, newMarker]); openMarkerDialog(newMarker);
    }
  };

  const handleZoom = (delta) => { setScale(prev => Math.max(0.2, Math.min(5, prev + delta))); };

  // Dialogs & Data
  const openMarkerDialog = (marker) => {
    setSelectedItem(marker); setNoteText(marker.label); setNoteDescription(marker.description || ''); setNotePhotos(marker.photos || []); setMarkerJournalEntries(marker.journalEntries || []); setLinkedPlant(marker.linkedPlant || null); setNewJournalText(''); setNewJournalPhotos([]); setShowNoteDialog(true);
  };
  const startRelocation = () => { if (selectedItem) { setRelocatingMarker(selectedItem); setShowNoteDialog(false); setSelectedItem(null); } };
  const finishRelocation = (save) => {
    if (!save && relocatingMarker) {
      const original = projects.find(p => p.id === currentProject.id)?.markers.find(m => m.id === relocatingMarker.id);
      if (original) setMarkers(markers.map(m => m.id === relocatingMarker.id ? original : m));
    }
    setRelocatingMarker(null);
  };
  const saveMarkerDetails = () => { setMarkers(markers.map(m => m.id === selectedItem.id ? { ...m, label: noteText, description: noteDescription, photos: notePhotos, journalEntries: markerJournalEntries, linkedPlant: linkedPlant } : m)); setShowNoteDialog(false); setSelectedItem(null); };
  const deleteMarker = () => { setMarkers(markers.filter(m => m.id !== selectedItem.id)); setShowNoteDialog(false); setSelectedItem(null); setShowDeleteMarkerConfirm(false); };
  const handleMarkerPhotoUpload = async (e) => { if (e.target.files[0]) { const reader = new FileReader(); reader.onload = async (evt) => { const r = await resizeImage(evt.target.result, 1200); setNotePhotos([...notePhotos, r]); }; reader.readAsDataURL(e.target.files[0]); } };
  const confirmRemovePhoto = (i) => setPhotoToDelete({ type: 'marker', index: i });
  const executeRemovePhoto = () => { 
    if (!photoToDelete) return;
    if (photoToDelete.type === 'marker') { const n = [...notePhotos]; n.splice(photoToDelete.index, 1); setNotePhotos(n); }
    if (photoToDelete.type === 'journal') { const n = [...newJournalPhotos]; n.splice(photoToDelete.index, 1); setNewJournalPhotos(n); }
    if (photoToDelete.type === 'globalJournal') { const n = [...newGlobalPhotos]; n.splice(photoToDelete.index, 1); setNewGlobalPhotos(n); }
    setPhotoToDelete(null);
  };
  const handleJournalPhotoUpload = async (e) => { if (e.target.files[0]) { const reader = new FileReader(); reader.onload = async (evt) => { const r = await resizeImage(evt.target.result, 1200); setNewJournalPhotos([...newJournalPhotos, r]); }; reader.readAsDataURL(e.target.files[0]); } };
  const addMarkerJournalEntry = () => { if (newJournalText.trim() || newJournalPhotos.length > 0) { setMarkerJournalEntries([{ id: Date.now(), timestamp: Date.now(), text: newJournalText, photos: newJournalPhotos }, ...markerJournalEntries]); setNewJournalText(''); setNewJournalPhotos([]); } };
  const deleteMarkerJournalEntry = (id) => setMarkerJournalEntries(markerJournalEntries.filter(e => e.id !== id));
  const handleGlobalJournalPhotoUpload = async (e) => { if (e.target.files[0]) { const reader = new FileReader(); reader.onload = async (evt) => { const r = await resizeImage(evt.target.result, 1200); setNewGlobalPhotos([...newGlobalPhotos, r]); }; reader.readAsDataURL(e.target.files[0]); } };
  const addGlobalJournalEntry = () => { if (newGlobalEntry.trim() || newGlobalPhotos.length > 0) { setGlobalJournalEntries([{ id: Date.now(), timestamp: Date.now(), text: newGlobalEntry, photos: newGlobalPhotos }, ...globalJournalEntries]); setNewGlobalEntry(''); setNewGlobalPhotos([]); } };
  const deleteGlobalJournalEntry = (id) => setGlobalJournalEntries(globalJournalEntries.filter(e => e.id !== id));

  useEffect(() => {
    if (!currentProject || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const img = imageRef.current;
    
    // Check if the image is actually ready before drawing
    if (!img || !img.complete || !imageLoaded) return;
    
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    const MARKER_RADIUS = 8;
    const LABEL_PADDING = 6;
    
    markers.forEach(marker => {
      const isMoving = relocatingMarker && relocatingMarker.id === marker.id;
      ctx.shadowColor = isMoving ? '#fbbf24' : marker.color; ctx.shadowBlur = isMoving ? 20 : 12; ctx.fillStyle = isMoving ? '#fbbf24' : marker.color; 
      ctx.beginPath(); ctx.arc(marker.x, marker.y, isMoving ? 12 : MARKER_RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0;
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
      ctx.font = 'bold 18px "DM Sans", sans-serif'; 
      const textMetrics = ctx.measureText(marker.label);
      const boxWidth = textMetrics.width + (LABEL_PADDING * 2);
      const boxHeight = 26;
      let labelX = marker.x + 14; let labelY = marker.y - 13;
      if (labelX + boxWidth > canvas.width) labelX = marker.x - 14 - boxWidth;
      ctx.fillStyle = 'rgba(0, 0, 0, 0.85)'; ctx.beginPath(); ctx.roundRect(labelX, labelY, boxWidth, boxHeight, 6); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle'; ctx.fillText(marker.label, labelX + LABEL_PADDING, labelY + (boxHeight / 2));
    });
  }, [markers, currentProject, relocatingMarker, imageLoaded]); // Added imageLoaded dependency

  return (
    <div className="h-screen w-screen flex flex-col bg-gray-950 text-white overflow-hidden select-none" style={{ fontFamily: '"DM Sans", sans-serif', backgroundColor: '#030712' }}>
      
      {/* HEADER (Conditional) */}
      {currentProject ? (
        <div className="bg-gray-900/95 backdrop-blur border-b border-gray-800 p-3 flex items-center justify-between z-20 shrink-0">
          <div className="flex items-center gap-2">
            <Leaf className="w-6 h-6 text-emerald-400" />
            <h1 className="text-lg font-bold text-emerald-400 truncate max-w-[140px]" style={{ fontFamily: '"Fraunces", serif' }}>{currentProject.name}</h1>
          </div>
          <div className="flex gap-2 relative">
            <button onClick={() => setShowSettings(true)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"><Settings className="w-5 h-5 text-gray-400" /></button>
            
            <div className="relative" ref={menuRef}>
              <button onClick={() => setShowProjectMenu(!showProjectMenu)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"><Image className="w-5 h-5 text-gray-300" /></button>
              {showProjectMenu && (
                  <div className="absolute top-full right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-xl shadow-2xl overflow-hidden z-50 flex flex-col">
                      <button onClick={() => fileInputRef.current?.click()} className="flex items-center gap-3 p-3 hover:bg-gray-700 text-left transition-colors"><Upload className="w-4 h-4" /> Upload New</button>
                      <div className="h-px bg-gray-700 mx-2"></div>
                      <button onClick={() => { setRenameText(currentProject.name); setShowRenameDialog(true); setShowProjectMenu(false); }} className="flex items-center gap-3 p-3 hover:bg-gray-700 text-left transition-colors"><Edit3 className="w-4 h-4" /> Rename Map</button>
                      <button onClick={() => { setShowDeleteProjectConfirm(true); setShowProjectMenu(false); }} className="flex items-center gap-3 p-3 hover:bg-red-900/30 text-red-400 text-left transition-colors"><Trash2 className="w-4 h-4" /> Delete Map</button>
                  </div>
              )}
            </div>

            <button onClick={() => { setShowSidebar(!showSidebar); setShowGlobalJournal(false); }} className={`p-2 rounded-xl transition-colors ${showSidebar ? 'bg-emerald-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}><List className="w-5 h-5" /></button>
            <button onClick={() => { setShowGlobalJournal(!showGlobalJournal); setShowSidebar(false); }} className={`p-2 rounded-xl transition-colors ${showGlobalJournal ? 'bg-blue-600 text-white' : 'bg-gray-800 hover:bg-gray-700 text-gray-300'}`}><BookOpen className="w-5 h-5" /></button>
          </div>
        </div>
      ) : null}

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} style={{ display: 'none' }} />

      <div className="flex-1 relative flex overflow-hidden">
        <div className="flex-1 relative bg-gray-950 overflow-hidden touch-none">
          {currentProject ? (
            <>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="relative transition-transform duration-75 origin-center pointer-events-auto" style={{ transform: `translate3d(${pan.x}px, ${pan.y}px, 0) scale(${scale})`, willChange: 'transform' }}>
                  <img 
                    ref={imageRef} 
                    src={currentProject.image} 
                    className="block pointer-events-none" 
                    onLoad={() => { 
                      if (canvasRef.current && imageRef.current) { 
                        canvasRef.current.width = imageRef.current.naturalWidth; 
                        canvasRef.current.height = imageRef.current.naturalHeight; 
                        canvasRef.current.style.width = imageRef.current.width + 'px'; 
                        canvasRef.current.style.height = imageRef.current.height + 'px';
                        setImageLoaded(true); // FIX: Trigger draw
                      } 
                    }} 
                  />
                  <canvas ref={canvasRef} className="absolute top-0 left-0" onClick={handleCanvasClick} onMouseDown={handleStart} onMouseMove={handleMove} onMouseUp={handleEnd} onMouseLeave={handleEnd} onTouchStart={handleStart} onTouchMove={handleMove} onTouchEnd={handleEnd} />
                </div>
              </div>
              
              {relocatingMarker ? (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-amber-900/90 backdrop-blur p-3 rounded-2xl shadow-2xl border border-amber-700 z-20 pointer-events-auto items-center">
                  <div className="text-amber-100 text-sm font-medium px-2">Move {relocatingMarker.label}</div><div className="h-6 w-px bg-amber-700/50 mx-1"></div>
                  <button onClick={() => finishRelocation(false)} className="p-2 hover:bg-amber-800 rounded-xl transition-colors text-amber-200"><X className="w-5 h-5" /></button>
                  <button onClick={() => finishRelocation(true)} className="p-2 bg-amber-600 hover:bg-amber-500 rounded-xl transition-colors text-white"><Check className="w-5 h-5" /></button>
                </div>
              ) : (
                <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-3 bg-gray-900/95 backdrop-blur p-2 rounded-2xl shadow-2xl border border-gray-800 z-10 pointer-events-auto">
                  <button onClick={() => setTool('pan')} className={`p-3.5 rounded-xl transition-all ${tool === 'pan' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}><Move className="w-6 h-6" /></button>
                  <button onClick={() => setTool('marker')} className={`p-3.5 rounded-xl transition-all ${tool === 'marker' ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30' : 'text-gray-400 hover:text-white hover:bg-gray-800'}`}><MapPin className="w-6 h-6" /></button>
                </div>
              )}

              <div className="absolute bottom-24 right-4 flex flex-col gap-2 z-10 pointer-events-auto">
                <button onClick={() => handleZoom(0.5)} className="p-3 bg-gray-900/95 backdrop-blur rounded-xl shadow-lg border border-gray-800 text-white hover:bg-gray-800 transition-colors"><Plus className="w-5 h-5" /></button>
                <button onClick={() => handleZoom(-0.5)} className="p-3 bg-gray-900/95 backdrop-blur rounded-xl shadow-lg border border-gray-800 text-white hover:bg-gray-800 transition-colors"><Minus className="w-5 h-5" /></button>
              </div>
              <button onClick={() => { setScale(1); setPan({x:0, y:0}); }} className="absolute top-4 left-4 bg-gray-900/90 backdrop-blur px-3 py-2 rounded-xl text-xs font-medium pointer-events-auto border border-gray-800 hover:bg-gray-800 transition-colors">Reset View</button>
            </>
          ) : (
             <div className="flex flex-col items-center justify-center h-full p-6 text-center">
                <div className="w-20 h-20 rounded-2xl bg-gray-900 flex items-center justify-center mb-6 border border-gray-800"><Leaf className="w-10 h-10 text-emerald-600" /></div>
                <h2 className="text-2xl font-bold mb-2" style={{ fontFamily: '"Fraunces", serif' }}>Welcome to Garden Planner</h2>
                <p className="text-gray-500 mb-6 max-w-xs">Upload a garden layout or floorplan image to start mapping your plants</p>
                <button onClick={() => fileInputRef.current?.click()} className="px-8 py-4 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold transition-colors flex items-center gap-2"><Image className="w-5 h-5" /> Upload Image</button>
                
                {/* Settings button on Welcome Screen */}
                <button onClick={() => setShowSettings(true)} className="mt-4 p-2 text-gray-500 hover:text-gray-400 flex items-center gap-2 text-xs">
                  <Settings className="w-4 h-4" /> Settings
                </button>
             </div>
          )}
        </div>
        {/* SIDEBAR AND JOURNAL OMITTED FOR BREVITY, BUT THEY ARE INCLUDED IN FULL SCRIPT BELOW */}
        {showSidebar && (
          <div className="absolute inset-0 bg-gray-950/98 z-30 p-4 overflow-y-auto backdrop-blur md:relative md:w-80 md:bg-gray-900/50 md:backdrop-blur-none md:border-l md:border-gray-800">
            <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-emerald-400" style={{ fontFamily: '"Fraunces", serif' }}>Plants & Markers</h2><button onClick={() => setShowSidebar(false)} className="md:hidden p-2 hover:bg-gray-800 rounded-xl"><X className="w-6 h-6" /></button></div>
            <div className="space-y-2">
              {markers.map(marker => (
                <div key={marker.id} className="p-4 bg-gray-800/50 rounded-xl flex justify-between items-center border border-gray-700/50 hover:bg-gray-800 cursor-pointer transition-colors" onClick={() => { openMarkerDialog(marker); setShowSidebar(false); }}>
                  <span className="flex items-center gap-3 font-medium">
                    <div className="w-4 h-4 rounded-full shadow-lg" style={{ backgroundColor: marker.color, boxShadow: `0 0 12px ${marker.color}40` }} />
                    <div><div className="text-white">{marker.label}</div>{marker.linkedPlant && <div className="text-xs text-gray-500 italic">{marker.linkedPlant.scientificName}</div>}</div>
                  </span>
                  <Edit3 className="w-4 h-4 text-gray-500" />
                </div>
              ))}
              {markers.length === 0 && <div className="text-center py-12"><MapPin className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">No markers yet</p></div>}
            </div>
          </div>
        )}
        {showGlobalJournal && (
          <div className="absolute inset-0 bg-gray-950/98 z-30 p-4 overflow-y-auto backdrop-blur md:relative md:w-96 md:bg-gray-900/50 md:backdrop-blur-none md:border-l md:border-gray-800">
             <div className="flex justify-between items-center mb-4"><h2 className="text-lg font-bold text-blue-400" style={{ fontFamily: '"Fraunces", serif' }}>Garden Journal</h2><button onClick={() => setShowGlobalJournal(false)} className="md:hidden p-2 hover:bg-gray-800 rounded-xl"><X className="w-6 h-6" /></button></div>
            <div className="mb-6 p-4 bg-gray-800/50 rounded-xl border border-gray-700/50">
              <textarea value={newGlobalEntry} onChange={(e) => setNewGlobalEntry(e.target.value)} placeholder="Write a journal entry..." className="w-full p-3 bg-gray-900 rounded-xl border border-gray-700 h-24 focus:outline-none focus:border-blue-500 resize-none text-sm" />
              {newGlobalPhotos.length > 0 && (
                <div className="grid grid-cols-4 gap-2 mt-3">
                  {newGlobalPhotos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square rounded-lg overflow-hidden"><img src={photo} alt="" className="w-full h-full object-cover" /><button onClick={() => setPhotoToDelete({ type: 'globalJournal', index: idx })} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full"><X className="w-3 h-3" /></button></div>
                  ))}
                </div>
              )}
              <div className="flex gap-2 mt-3">
                <button onClick={() => globalJournalPhotoInputRef.current?.click()} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"><Camera className="w-5 h-5 text-gray-300" /></button>
                <button onClick={addGlobalJournalEntry} className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg font-semibold transition-colors">Add Entry</button>
              </div>
              <input ref={globalJournalPhotoInputRef} type="file" accept="image/*" onChange={handleGlobalJournalPhotoUpload} className="hidden" />
            </div>
            <div className="space-y-3">
              {globalJournalEntries.map(entry => <JournalEntry key={entry.id} entry={entry} onDelete={deleteGlobalJournalEntry} onViewPhoto={setViewingImage} />)}
              {globalJournalEntries.length === 0 && <div className="text-center py-12"><BookOpen className="w-12 h-12 text-gray-700 mx-auto mb-3" /><p className="text-gray-500">No journal entries yet</p></div>}
            </div>
          </div>
        )}
      </div>

      {showNoteDialog && (
        <div className="fixed inset-0 bg-black/90 flex items-center justify-center p-2 z-50 backdrop-blur-sm overflow-y-auto">
          <div className="bg-gray-900 rounded-2xl p-5 w-full max-w-lg border border-gray-800 shadow-2xl flex flex-col max-h-[95vh] my-auto">
            <div className="flex justify-between items-center mb-5 shrink-0"><h3 className="text-xl font-bold text-emerald-400" style={{ fontFamily: '"Fraunces", serif' }}>Plant Details</h3><button onClick={() => setShowNoteDialog(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"><X className="w-5 h-5"/></button></div>
            <div className="flex-1 overflow-y-auto pr-1 space-y-5">
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">Plant Name</label>
                <PlantSearch value={noteText} onChange={setNoteText} onSelectPlant={(plant) => setLinkedPlant(plant)} perenualKey={perenualKey} trefleToken={trefleToken} />
                {linkedPlant && (
                  <div className="mt-3 p-3 bg-emerald-950/30 rounded-xl border border-emerald-900/30 flex items-center gap-3">
                    {linkedPlant.imageUrl ? <img src={linkedPlant.imageUrl} className="w-12 h-12 rounded-lg object-cover" /> : <div className="w-12 h-12 rounded-lg bg-gray-800 flex items-center justify-center"><Leaf className="w-6 h-6 text-emerald-600" /></div>}
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-emerald-400 truncate flex items-center gap-2">{linkedPlant.displayName} {linkedPlant.source === 'wikipedia' && <span className="text-[10px] px-1.5 py-0.5 bg-gray-200 text-gray-800 rounded font-medium">Wiki</span>}</div>
                      <div className="text-sm text-gray-400 italic truncate">{linkedPlant.scientificName}</div>
                    </div>
                    <a href={linkedPlant.infoUrl} target="_blank" rel="noopener noreferrer" className="p-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors"><ExternalLink className="w-4 h-4" /></a>
                  </div>
                )}
              </div>
              
              <div>
                <div className="flex justify-between items-end mb-2">
                  <label className="text-xs text-gray-400 uppercase font-bold tracking-wider">Notes</label>
                  <button onClick={() => setShowFullNote(true)} className="text-xs text-emerald-400 hover:text-emerald-300 flex items-center gap-1"><Maximize2 className="w-3 h-3" /> Expand</button>
                </div>
                <textarea value={noteDescription} onChange={(e) => setNoteDescription(e.target.value)} className="w-full p-3 bg-gray-800 rounded-xl text-white border border-gray-700 focus:border-emerald-500 focus:outline-none h-20 resize-none" placeholder="Planting date, variety, care notes..." />
              </div>

              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2">Photos</label>
                <div className="grid grid-cols-3 gap-2">
                  {notePhotos.map((photo, idx) => (
                    <div key={idx} className="relative aspect-square bg-gray-800 rounded-xl overflow-hidden border border-gray-700 group cursor-pointer" onClick={() => setViewingImage(photo)}>
                      <img src={photo} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"><Maximize2 className="w-6 h-6 text-white drop-shadow-lg" /></div>
                      <button onClick={(e) => { e.stopPropagation(); confirmRemovePhoto(idx); }} className="absolute top-1.5 right-1.5 bg-red-600 p-1.5 rounded-full text-white opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shadow-lg"><X className="w-3 h-3" /></button>
                    </div>
                  ))}
                  <button onClick={() => photoInputRef.current?.click()} className="aspect-square bg-gray-800/50 rounded-xl border-2 border-dashed border-gray-600 flex flex-col items-center justify-center text-gray-400 hover:bg-gray-800 hover:text-white hover:border-gray-500 transition-colors"><Camera className="w-6 h-6 mb-1" /><span className="text-xs">Add</span></button>
                </div>
                <input ref={photoInputRef} type="file" accept="image/*" onChange={handleMarkerPhotoUpload} className="hidden" />
              </div>
              <div>
                <label className="text-xs text-gray-400 uppercase font-bold tracking-wider block mb-2"><Clock className="w-3 h-3 inline mr-1" /> Journal Entries</label>
                <div className="p-3 bg-gray-800/50 rounded-xl border border-gray-700/50 mb-3">
                  <textarea value={newJournalText} onChange={(e) => setNewJournalText(e.target.value)} placeholder="Add a timestamped note..." className="w-full p-2 bg-gray-900 rounded-lg border border-gray-700 h-16 focus:outline-none focus:border-emerald-500 resize-none text-sm" />
                  {newJournalPhotos.length > 0 && (
                    <div className="grid grid-cols-4 gap-2 mt-2">
                      {newJournalPhotos.map((photo, idx) => (
                        <div key={idx} className="relative aspect-square rounded-lg overflow-hidden"><img src={photo} alt="" className="w-full h-full object-cover" /><button onClick={() => setPhotoToDelete({ type: 'journal', index: idx })} className="absolute top-1 right-1 bg-red-600 p-1 rounded-full"><X className="w-2 h-2" /></button></div>
                      ))}
                    </div>
                  )}
                  <div className="flex gap-2 mt-2">
                    <button onClick={() => journalPhotoInputRef.current?.click()} className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"><Camera className="w-4 h-4 text-gray-300" /></button>
                    <button onClick={addMarkerJournalEntry} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 rounded-lg font-semibold text-sm transition-colors">Add Entry</button>
                  </div>
                  <input ref={journalPhotoInputRef} type="file" accept="image/*" onChange={handleJournalPhotoUpload} className="hidden" />
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto">{markerJournalEntries.map(entry => <JournalEntry key={entry.id} entry={entry} onDelete={deleteMarkerJournalEntry} onViewPhoto={setViewingImage} />)}</div>
              </div>
            </div>
            <div className="flex gap-3 mt-5 pt-4 border-t border-gray-800 shrink-0">
              <button onClick={saveMarkerDetails} className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><Save className="w-5 h-5" /> Save</button>
              <button onClick={startRelocation} className="flex-1 py-3 bg-amber-600/90 hover:bg-amber-600 rounded-xl font-bold flex items-center justify-center gap-2 transition-colors"><GripHorizontal className="w-5 h-5" /> Relocate</button>
              <button onClick={() => setShowDeleteMarkerConfirm(true)} className="px-5 py-3 bg-red-950/50 text-red-400 rounded-xl border border-red-900/30 hover:bg-red-900/50 transition-colors"><Trash2 className="w-5 h-5" /></button>
            </div>
          </div>
        </div>
      )}

      {showFullNote && (
        <div className="fixed inset-0 z-[70] bg-gray-950 flex flex-col animate-in slide-in-from-bottom-10 duration-200">
           <div className="p-4 border-b border-gray-800 flex justify-between items-center bg-gray-900">
              <h3 className="text-lg font-bold text-white">Edit Notes</h3>
              <button onClick={() => setShowFullNote(false)} className="p-2 bg-gray-800 hover:bg-gray-700 rounded-xl transition-colors"><Minimize2 className="w-5 h-5 text-gray-400" /></button>
           </div>
           <div className="flex-1 p-4">
              <textarea value={noteDescription} onChange={(e) => setNoteDescription(e.target.value)} className="w-full h-full bg-transparent text-gray-300 text-lg leading-relaxed resize-none focus:outline-none" placeholder="Start typing detailed notes..." autoFocus />
           </div>
        </div>
      )}

      {viewingImage && (
        <div className="fixed inset-0 z-[60] bg-black flex items-center justify-center p-0" onClick={() => setViewingImage(null)}>
           <img src={viewingImage} className="max-w-full max-h-full object-contain" />
           <button className="absolute top-4 right-4 bg-gray-900/80 backdrop-blur p-3 rounded-xl text-white hover:bg-gray-800 transition-colors"><X className="w-6 h-6" /></button>
        </div>
      )}

      <SettingsPanel isOpen={showSettings} onClose={() => setShowSettings(false)} perenualKey={perenualKey} trefleToken={trefleToken} onKeysChange={saveConfig} />
      <ConfirmDialog isOpen={photoToDelete !== null} title="Delete Photo?" message="This photo will be permanently removed." onConfirm={executeRemovePhoto} onCancel={() => setPhotoToDelete(null)} />
      <ConfirmDialog isOpen={showDeleteMarkerConfirm} title="Delete Marker?" message="This marker and all its journal entries will be permanently deleted." onConfirm={deleteMarker} onCancel={() => setShowDeleteMarkerConfirm(false)} />
      <ConfirmDialog isOpen={showDeleteProjectConfirm} title="Delete Garden Plan?" message="This entire garden plan including all markers and journal entries will be permanently deleted." onConfirm={deleteCurrentProject} onCancel={() => setShowDeleteProjectConfirm(false)} />
    </div>
  );
};

export default GardenPlanner;
