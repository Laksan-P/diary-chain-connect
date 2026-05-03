-- Table for Custom Support Issues / Tickets
CREATE TABLE IF NOT EXISTS support_tickets (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id),
    role TEXT NOT NULL CHECK (role IN ('farmer', 'chilling_center')),
    message TEXT NOT NULL,
    reply TEXT,
    reply_si TEXT,
    reply_ta TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'replied')),
    language TEXT NOT NULL DEFAULT 'en',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    replied_at TIMESTAMP WITH TIME ZONE,
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Notification status
    is_read_by_user BOOLEAN DEFAULT TRUE,
    is_read_by_admin BOOLEAN DEFAULT FALSE,
    
    -- For Farmers: which CC are they from? (optional but helpful for Nestlé context)
    cc_id INTEGER REFERENCES chilling_centers(id)
);

-- Indexing for performance
CREATE INDEX idx_support_tickets_user_id ON support_tickets(user_id);
CREATE INDEX idx_support_tickets_status ON support_tickets(status);
CREATE INDEX idx_support_tickets_cc_id ON support_tickets(cc_id);
CREATE INDEX idx_support_tickets_last_activity ON support_tickets(last_activity_at);
