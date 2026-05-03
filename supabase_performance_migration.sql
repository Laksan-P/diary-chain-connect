-- Add performance columns to farmers
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS performance_status TEXT DEFAULT 'Good';
ALTER TABLE farmers ADD COLUMN IF NOT EXISTS performance_recommendation TEXT;

-- Add performance columns to chilling_centers
ALTER TABLE chilling_centers ADD COLUMN IF NOT EXISTS performance_status TEXT DEFAULT 'Good';
ALTER TABLE chilling_centers ADD COLUMN IF NOT EXISTS performance_recommendation TEXT;
