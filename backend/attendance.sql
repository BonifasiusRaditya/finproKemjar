-- Create attendance table for employee attendance tracking
-- Run this SQL in your PostgreSQL database

CREATE TABLE IF NOT EXISTS attendance (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL,
    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,
    check_in_time TIME,
    check_out_time TIME,
    status VARCHAR(20) DEFAULT 'absent',
    notes TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    UNIQUE(user_id, attendance_date)
);

-- Create index for better performance
CREATE INDEX IF NOT EXISTS idx_attendance_date ON attendance(attendance_date);
CREATE INDEX IF NOT EXISTS idx_attendance_user_date ON attendance(user_id, attendance_date);

-- Insert sample attendance data for testing
-- Make sure to replace user IDs with actual IDs from your users table
INSERT INTO attendance (user_id, attendance_date, check_in_time, check_out_time, status, notes) 
VALUES 
    (1, CURRENT_DATE, '08:30:00', NULL, 'present', 'Checked in on time'),
    (2, CURRENT_DATE, '09:00:00', '17:30:00', 'present', 'Regular attendance'),
    (1, CURRENT_DATE - INTERVAL '1 day', '08:45:00', '17:15:00', 'present', 'Previous day attendance'),
    (2, CURRENT_DATE - INTERVAL '1 day', NULL, NULL, 'absent', 'Did not check in')
ON CONFLICT (user_id, attendance_date) DO NOTHING;

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to automatically update updated_at
DROP TRIGGER IF EXISTS update_attendance_updated_at_trigger ON attendance;
CREATE TRIGGER update_attendance_updated_at_trigger
    BEFORE UPDATE ON attendance
    FOR EACH ROW
    EXECUTE FUNCTION update_attendance_updated_at();

-- View for easy attendance reporting
CREATE OR REPLACE VIEW attendance_report AS
SELECT 
    a.id,
    u.username,
    u.role,
    a.attendance_date,
    a.check_in_time,
    a.check_out_time,
    a.status,
    a.notes,
    a.created_at,
    CASE 
        WHEN a.check_in_time IS NOT NULL AND a.check_in_time <= '09:00:00' THEN 'On Time'
        WHEN a.check_in_time IS NOT NULL AND a.check_in_time > '09:00:00' THEN 'Late'
        ELSE 'Absent'
    END as punctuality_status
FROM attendance a
JOIN users u ON a.user_id = u.id
ORDER BY a.attendance_date DESC, u.username;