-- Migration to create logs table for storing webhook, websocket, and connection events
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    topic TEXT NOT NULL,
    event_type TEXT NOT NULL, -- 'webhook', 'websocket_connect', 'websocket_message', 'websocket_disconnect'
    timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
    client_ip TEXT,
    client_headers TEXT, -- JSON string
    data TEXT, -- JSON string containing event-specific data
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_logs_topic ON logs(topic);
CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_topic_timestamp ON logs(topic, timestamp);
CREATE INDEX IF NOT EXISTS idx_logs_event_type ON logs(event_type);