const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = 6767;

// Middleware
app.use(express.json());
app.use(express.static('public'));
app.use('/uploads', express.static('uploads'));
app.use('/templates', express.static('templates'));

// Upload qovluğunu yarat (əgər yoxdursa)
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads');
}

// Multer config - şəkil yükləmə
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueName = Date.now() + '-' + file.originalname;
        cb(null, uniqueName);
    }
});

const upload = multer({
    storage: storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('only image files can upload!'));
        }
    }
});

// --- API ROUTES ---

// 1. Şəkil yükləmək
app.post('/api/upload', upload.single('image'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Fayl yüklənmədi!' });
        }
        const imageUrl = `/uploads/${req.file.filename}`;
        res.json({
            success: true,
            message: 'image succesfuly downloaded!',
            imageUrl: imageUrl
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 2. Hazır fon şablonlarını almaq
app.get('/api/templates', (req, res) => {
    const templateDir = path.join(__dirname, 'templates');
    try {
        const files = fs.readdirSync(templateDir);
        const templates = files
            .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map(file => `/templates/${file}`);
        res.json({ templates });
    } catch (error) {
        res.status(500).json({ error: 'layers did not download' });
    }
});

// 3. Şəkli silmək (upload edilmiş)
app.delete('/api/delete/:filename', (req, res) => {
    const filename = req.params.filename;
    const filepath = path.join(__dirname, 'uploads', filename);
    try {
        if (fs.existsSync(filepath)) {
            fs.unlinkSync(filepath);
            res.json({ success: true, message: 'image deleted!' });
        } else {
            res.status(404).json({ error: 'can not find!' });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/uploads', (req, res) => {
    const uploadDir = path.join(__dirname, 'uploads');
    try {
        const files = fs.readdirSync(uploadDir);
        const images = files
            .filter(file => /\.(jpg|jpeg|png|gif|webp)$/i.test(file))
            .map(file => `/uploads/${file}`);
        res.json({ images });
    } catch (error) {
        res.status(500).json({ error: 'files did not download' });
    }
});

// Serveri başlat
app.listen(PORT, () => {
    console.log(`🚀 Server çalışır: http://localhost:${PORT}`);
});