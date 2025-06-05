// app.js
const path = require('path');
const fs = require('fs');
const express = require('express');
const OS = require('os');
const bodyParser = require('body-parser');
const mongoose = require("mongoose");
const app = express();
const cors = require('cors');
const serverless = require('serverless-http');

app.use(bodyParser.json());
app.use(cors());

mongoose.connect(process.env.MONGO_URI, {
    user: process.env.MONGO_USERNAME,
    pass: process.env.MONGO_PASSWORD,
})
.then(() => {
    console.log("MongoDB Connection Successful");
})
.catch((err) => {
    console.log("error!! " + err);
});

const Schema = mongoose.Schema;
const dataSchema = new Schema({
    name: String,
    id: Number,
    description: String,
    image: String,
    velocity: String,
    distance: String
});
const planetModel = mongoose.model('planets', dataSchema);

app.post('/planet', (req, res) => {
    planetModel.findOne({ id: req.body.id }, (err, planetData) => {
        if (err) {
            res.send("Error in Planet Data");
        } else {
            res.send(planetData);
        }
    });
});

app.get("/", (req, res) => {
    const htmlPath = path.join(__dirname, "index.html");
    fs.readFile(htmlPath, "utf8", (err, data) => {
        if (err) {
            console.error("Error reading index.html:", err);
            return res.status(500).send("Error loading HTML");
        }

        const secretValue    = process.env.ENV_SECRET   || "Not set";
        const configmapValue = process.env.ENV_CONFIGMAP || "Not set";
        const buildIdValue   = process.env.ENV_BUILD_ID  || "Not set";

        let rendered = data.replace(/{{\s*ENV_SECRET\s*}}/g, secretValue);
        rendered     = rendered.replace(/{{\s*ENV_CONFIGMAP\s*}}/g, configmapValue);
        rendered     = rendered.replace(/{{\s*BUILD_ID\s*}}/g, buildIdValue);

        res.send(rendered);
    });
});

app.get('/api-docs', (req, res) => {
    fs.readFile('oas.json', 'utf8', (err, data) => {
        if (err) {
            console.error('Error reading file:', err);
            return res.status(500).send('Error reading file');
        }
        res.json(JSON.parse(data));
    });
});

app.get('/os', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send({
        os: OS.hostname(),
        env: process.env.NODE_ENV
    });
});

app.get('/live', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send({
        status: "live"
    });
});

app.get('/ready', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send({
        status: "ready"
    });
});

// Only start server if this file is run directly
if (require.main === module) {
    app.listen(3000, () => {
        console.log("Server successfully running on port - 3000");
    });
}

module.exports = app;
app.use(express.static(path.join(__dirname, '/')));
