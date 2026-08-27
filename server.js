const express = require('express');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { MongoClient } = require('mongodb');

const app = express();
const PORT = process.env.PORT || 3000;
const DB_FILE = path.join(__dirname, 'db.json');

// Use MONGODB_URI environment variable (from Render/Heroku)
const MONGODB_URI = process.env.MONGODB_URI;

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
    stitching: [],
    labours: []
};

// MongoDB setup variables
let mongoClient = null;
let dbCollection = null;
let memoryDB = { ...initialDB };
let useMongo = false;

async function initMongoDB() {
    if (!MONGODB_URI) {
        console.log("No MONGODB_URI environment variable found. Falling back to local db.json.");
        loadLocalDB();
        return;
    }

    try {
        console.log("Connecting to MongoDB Atlas...");
        mongoClient = new MongoClient(MONGODB_URI);
        await mongoClient.connect();
        const db = mongoClient.db('bindi_market_db');
        dbCollection = db.collection('database_store');
        
        // Load initial database from MongoDB or initialize if empty
        const doc = await dbCollection.findOne({ type: 'main_db' });
        if (doc) {
            memoryDB = doc.data;
            console.log("Successfully connected to MongoDB Atlas and loaded database.");
        } else {
            console.log("Database document not found in MongoDB. Initializing with default schema...");
            await dbCollection.insertOne({ type: 'main_db', data: initialDB });
            memoryDB = { ...initialDB };
        }
        useMongo = true;
    } catch (err) {
        console.error("Failed to connect to MongoDB. Falling back to local db.json. Error:", err.message);
        loadLocalDB();
    }
}

function loadLocalDB() {
    try {
        if (!fs.existsSync(DB_FILE)) {
            fs.writeFileSync(DB_FILE, JSON.stringify(initialDB, null, 2));
            memoryDB = { ...initialDB };
            return;
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
        memoryDB = db;
        console.log("Loaded local db.json successfully.");
    } catch (err) {
        console.error('Error reading db.json, returning default state:', err);
        memoryDB = { ...initialDB };
    }
}

async function saveDBKey(key, data) {
    memoryDB[key] = data;
    
    if (useMongo && dbCollection) {
        try {
            await dbCollection.updateOne({ type: 'main_db' }, { $set: { [`data.${key}`]: data } });
            console.log(`Synced key "${key}" to MongoDB Atlas.`);
        } catch (err) {
            console.error(`Error saving key "${key}" to MongoDB:`, err.message);
        }
    } else {
        try {
            fs.writeFileSync(DB_FILE, JSON.stringify(memoryDB, null, 2));
            console.log(`Saved key "${key}" to local db.json.`);
        } catch (err) {
            console.error('Error writing to db.json:', err);
        }
    }
}

// API Routes
app.get('/api/db', (req, res) => {
    res.json(memoryDB);
});

app.post('/api/db/:key', async (req, res) => {
    const key = req.params.key;
    if (memoryDB[key] !== undefined) {
        await saveDBKey(key, req.body);
        res.json({ success: true, message: `Key "${key}" updated successfully.` });
    } else {
        res.status(400).json({ success: false, message: `Invalid key "${key}".` });
    }
});

// Fallback to index.html for spa behavior
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Initialize MongoDB and Start Server
initMongoDB().then(() => {
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
});
