const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');

const app = express();
app.use(bodyParser.json());
app.use(cors());

// In-memory storage for incoming WhatsApp requests and issued licenses
let pendingRequests = [];
let issuedLicenses = [];

// ==========================================
// 1. Meta WhatsApp Webhook Verification
// ==========================================
app.get('/webhook', (req, res) => {
    const VERIFY_TOKEN = "localforge_secure_token"; // Must match the token you enter in Meta Developer Console
    
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];

    if (mode && token) {
        if (mode === 'subscribe' && token === VERIFY_TOKEN) {
            console.log("WEBHOOK_VERIFIED");
            res.status(200).send(challenge);
        } else {
            res.sendStatus(403);
        }
    } else {
        res.sendStatus(400);
    }
});

// ==========================================
// 2. Receive Incoming WhatsApp Messages
// ==========================================
app.post('/webhook', (req, res) => {
    try {
        const body = req.body;

        if (body.object === 'whatsapp_business_account') {
            body.entry.forEach(entry => {
                const changes = entry.changes;
                changes.forEach(change => {
                    if (change.value.messages) {
                        const message = change.value.messages[0];
                        const senderPhone = message.from; // e.g., "919876543210"
                        const messageText = message.text ? message.text.body : "Media/Other Message";
                        const senderName = change.value.contacts?.[0]?.profile?.name || "WhatsApp Client";

                        // Push incoming request into your CRM queue
                        const newRequest = {
                            id: Date.now(),
                            client: senderName,
                            phone: senderPhone,
                            message: messageText,
                            app: "LocalForge App",
                            time: new Date().toLocaleTimeString()
                        };

                        pendingRequests.unshift(newRequest);
                        console.log(`New WhatsApp message from ${senderName} (${senderPhone}): ${messageText}`);
                    }
                });
            });
            res.status(200).send('EVENT_RECEIVED');
        } else {
            res.sendStatus(404);
        }
    } catch (error) {
        console.error("Error processing webhook:", error);
        res.sendStatus(500);
    }
});

// ==========================================
// 3. API Endpoints for your Frontend CRM
// ==========================================

// Get all pending incoming WhatsApp requests
app.get('/api/requests', (req, res) => {
    res.json(pendingRequests);
});

// Remove a request once fulfilled/cleared from CRM
app.post('/api/clear-request', (req, res) => {
    const { requestId } = req.body;
    pendingRequests = pendingRequests.filter(r => r.id !== requestId);
    res.json({ success: true });
});

// Health check endpoint
app.get('/', (req, res) => {
    res.send('LocalForge Tech WhatsApp Webhook Server is running successfully!');
});

// ==========================================
// 4. Start Server
// ==========================================
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});