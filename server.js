import express from 'express';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 80;
const DATA_DIR = path.join(__dirname, 'data');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const DATA_FILE = path.join(DATA_DIR, 'garden-data.json');
const CONFIG_FILE = path.join(DATA_DIR, 'config.json');

app.use(express.json({ limit: '200mb' }));
app.use(express.static(path.join(__dirname, 'dist')));
app.use('/uploads', express.static(UPLOADS_DIR));

const initData = async () => {
  try { await fs.access(DATA_DIR); } catch { await fs.mkdir(DATA_DIR, { recursive: true }); }
  try { await fs.access(UPLOADS_DIR); } catch { await fs.mkdir(UPLOADS_DIR, { recursive: true }); }
};
initData();

const processImage = async (imgData) => {
  if (!imgData || !imgData.startsWith('data:image')) return imgData;
  try {
    const matches = imgData.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
    if (!matches || matches.length !== 3) return imgData;
    const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
    const buffer = Buffer.from(matches[2], 'base64');
    const hash = crypto.createHash('md5').update(buffer).digest('hex');
    const filename = `${hash}.${ext}`;
    const filePath = path.join(UPLOADS_DIR, filename);
    await fs.writeFile(filePath, buffer);
    return `/uploads/${filename}`;
  } catch (error) {
    console.error("Error saving image:", error);
    return imgData;
  }
};

const cleanProjectData = async (projects) => {
  const updatedProjects = [];
  for (let project of projects) {
    if (project.image) project.image = await processImage(project.image);
    if (project.markers) {
      for (let marker of project.markers) {
        if (marker.photos) {
          for (let i = 0; i < marker.photos.length; i++) marker.photos[i] = await processImage(marker.photos[i]);
        }
        if (marker.journalEntries) {
          for (let entry of marker.journalEntries) {
            if (entry.photos) {
              for (let i = 0; i < entry.photos.length; i++) entry.photos[i] = await processImage(entry.photos[i]);
            }
          }
        }
      }
    }
    if (project.globalJournalEntries) {
      for (let entry of project.globalJournalEntries) {
        if (entry.photos) {
          for (let i = 0; i < entry.photos.length; i++) entry.photos[i] = await processImage(entry.photos[i]);
        }
      }
    }
    updatedProjects.push(project);
  }
  return updatedProjects;
};

app.get('/api/projects', async (req, res) => {
  try {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) { res.json([]); }
});

app.post('/api/projects', async (req, res) => {
  try {
    const cleanData = await cleanProjectData(req.body);
    await fs.writeFile(DATA_FILE, JSON.stringify(cleanData, null, 2));
    res.json({ success: true, data: cleanData });
  } catch (error) {
    console.error('Save failed:', error);
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.get('/api/config', async (req, res) => {
  try {
    const data = await fs.readFile(CONFIG_FILE, 'utf8');
    res.json(JSON.parse(data));
  } catch (error) { res.json({ perenualApiKey: '' }); }
});

app.post('/api/config', async (req, res) => {
  try {
    await fs.writeFile(CONFIG_FILE, JSON.stringify(req.body, null, 2));
    res.json({ success: true });
  } catch (error) {
    console.error('Config save failed:', error);
    res.status(500).json({ error: 'Failed to save config' });
  }
});

app.get('/api/wiki/search', async (req, res) => {
  try {
    const { q } = req.query;
    const url = `https://en.wikipedia.org/w/api.php?action=query&generator=prefixsearch&gpssearch=${encodeURIComponent(q)}&gpslimit=5&prop=pageimages|extracts&exintro&explaintext&exchars=200&piprop=thumbnail&pithumbsize=300&format=json&origin=*`;
    const response = await fetch(url, { headers: { 'User-Agent': 'GardenPlanner/1.0' } });
    const data = await response.json();
    const pages = data.query ? Object.values(data.query.pages) : [];
    pages.sort((a, b) => a.index - b.index);
    res.json({ data: pages });
  } catch (error) {
    console.error('Wikipedia search failed:', error);
    res.status(500).json({ error: 'Failed to search Wikipedia' });
  }
});

app.get('/api/plants/search', async (req, res) => {
  try {
    const { q, key } = req.query;
    if (!key) return res.status(400).json({ error: 'API key required' });
    const response = await fetch(`https://perenual.com/api/species-list?key=${key}&q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Plant search failed:', error);
    res.status(500).json({ error: 'Failed to search plants' });
  }
});

app.get('/api/trefle/search', async (req, res) => {
  try {
    const { q, token } = req.query;
    if (!token) return res.status(400).json({ error: 'Trefle API token required' });
    const response = await fetch(`https://trefle.io/api/v1/plants/search?token=${token}&q=${encodeURIComponent(q)}`);
    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error('Trefle search failed:', error);
    res.status(500).json({ error: 'Failed to search Trefle' });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Garden Planner server running on port ${PORT}`);
});
