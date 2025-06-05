const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

// Serve static files from the 'public' directory
// The 'index.html' and your existing client-side script will be in 'public'.
app.use(express.static(path.join(__dirname, 'public')));

// Define the directory where OBJ templates are stored
const templatesDir = path.join(__dirname, 'templates');

// Ensure the 'templates' directory exists. Create it if it doesn't.
if (!fs.existsSync(templatesDir)) {
    fs.mkdirSync(templatesDir);
    console.log(`Created 'templates' directory at: ${templatesDir}`);
    console.log(`Please place your .obj template files inside the '${templatesDir}' directory.`);
}

// Endpoint to list all available OBJ templates
app.get('/templates', (req, res) => {
    fs.readdir(templatesDir, (err, files) => {
        if (err) {
            console.error('Error reading templates directory:', err);
            return res.status(500).json({ error: 'Failed to read templates directory' });
        }
        // Filter out only files ending with .obj (case-insensitive)
        const objFiles = files.filter(file => file.toLowerCase().endsWith('.obj'));
        res.json(objFiles);
    });
});

// Endpoint to serve a specific OBJ template file by its filename
app.get('/templates/:filename', (req, res) => {
    const filename = req.params.filename;
    const filePath = path.join(templatesDir, filename);

    // Security check: Prevent directory traversal attacks
    // Ensures that the requested file is strictly within the 'templatesDir'.
    if (!filePath.startsWith(templatesDir)) {
        return res.status(400).send('Invalid filename.');
    }

    fs.readFile(filePath, (err, data) => {
        if (err) {
            console.error(`Error reading file ${filePath}:`, err);
            if (err.code === 'ENOENT') {
                return res.status(404).send('File not found.'); // File doesn't exist
            }
            return res.status(500).send('Failed to read file.'); // Other file system error
        }
        // Set Content-Type header to indicate it's an OBJ model or plain text
        res.setHeader('Content-Type', 'model/obj'); // Common MIME type for OBJ
        res.send(data); // Send the file content
    });
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
    console.log(`Open http://localhost:${PORT} in your browser.`);
});
