const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// Middleware
app.use(express.json({ limit: '50mb' })); // Support base64 images
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files
app.use(express.static(__dirname));

// Initialize db.json if not exists
const initialDB = {
    parties: [],
    cities: [],
    banks: [],
    catalogues: [],
    groups: [],
    colors: [],
    sizes: [],
    products: [],
    combo_products: [],
    inwards: [],
    outwards: [],
    stitching: []
};

function readDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
            return initialDB;
        }
        const data = fs.readFileSync(DB_FILE, 'utf8');
        const db = JSON.parse(data);
        
        // Ensure all required database keys exist
        let updated = false;
        for (const key in initialDB) {
            if (db[key] === undefined) {
                db[key] = [];
                updated = true;
            }
        }
        if (updated) {
            fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
        }
        return db;
    } catch (err) {
        console.error('Error reading db.json, returning default state:', err);
        return initialDB;
    }
}

function writeDB(db) {
    try {
        fs.writeFileSync(DB_FILE, JSON.stringify(db, null, 2));
    } catch (err) {
        console.error('Error writing to db.json:', err);
    }
}

// API Routes
app.get('/api/db', (req, res) => {
    res.json(readDB());
});

app.post('/api/db/:key', (req, res) => {
    const key = req.params.key;
    const db = readDB();
    
    if (db[key] !== undefined) {
        db[key] = req.body;
        writeDB(db);
        res.json({ success: true, message: `Key "${key}" updated successfully.` });
    } else {
        res.status(400).json({ success: false, message: `Invalid key "${key}".` });
    }
});

// Fallback to index.html for spa behavior
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Start Server
app.listen(PORT, '0.0.0.0', () => {
    console.log('\n==================================================');
    console.log(`Bindi Market System Server is running on port ${PORT}`);
    console.log('==================================================');
    console.log(`- Access on this PC: http://localhost:${PORT}`);
    
    // Log local network IPs for other PCs to connect
    const interfaces = os.networkInterfaces();
    let count = 0;
    for (const name in interfaces) {
        for (const iface of interfaces[name]) {
            if (iface.family === 'IPv4' && !iface.internal) {
                console.log(`- Access from other PCs on same Wi-Fi: http://${iface.address}:${PORT}`);
                count++;
            }
        }
    }
    if (count === 0) {
        console.log('- (Connect to Wi-Fi/Ethernet to access from other PCs)');
    }
    console.log('==================================================\n');
});
