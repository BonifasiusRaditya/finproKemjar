# Database Setup Instructions

## Setup Attendance System Database

### Step 1: Connect to PostgreSQL Database
1. Open your PostgreSQL client (pgAdmin, psql, or database management tool)
2. Connect to your Neon database using the connection string from `.env` file

### Step 2: Run SQL Setup
1. Open the file `backend/attendance.sql`
2. Copy and paste the entire SQL content into your database query editor
3. Execute the SQL commands

This will create:
- `attendance` table for storing employee attendance records
- Indexes for better performance
- Sample data for testing
- View for attendance reporting
- Triggers for automatic timestamp updates

### Step 3: Verify Setup
Run this query to verify the setup:

```sql
SELECT * FROM attendance_report WHERE attendance_date = CURRENT_DATE;
```

### Step 4: Test API Endpoints
1. Start the backend server: `node server.js`
2. The following new endpoints are available:
   - `GET /api/attendance/today` - Get today's attendance for current user
   - `POST /api/attendance/checkin` - Check in for today
   - `POST /api/attendance/checkout` - Check out for today
   - `GET /api/admin/attendance/today` - Get all attendance for today (admin)
   - `GET /api/admin/attendance/stats` - Get attendance statistics (admin)
   - `DELETE /api/admin/attendance/reset/:userId` - Reset user attendance (admin)
   - `DELETE /api/admin/attendance/reset-all` - Reset all attendance (admin)

### Step 5: Frontend Integration
The frontend has been updated to:
- Use database API instead of localStorage
- Show real-time attendance statistics
- Display punctuality status (On Time/Late/Absent)
- Allow admin to reset individual or all attendance records
- Show proper check-in/check-out times from database

### Features Implemented:

#### For Employees:
- ✅ Check-in button (stores time in database)
- ✅ Check-out button (updates checkout time)
- ✅ View today's attendance status
- ✅ Prevent duplicate check-ins

#### For Admins:
- ✅ View all employee attendance for today
- ✅ Real-time statistics (Present/Absent/Late counts)
- ✅ Reset individual employee attendance
- ✅ Reset all attendance for today
- ✅ Punctuality tracking (Late if check-in after 9:00 AM)
- ✅ Employee management table

### Database Schema:
```
attendance table:
- id (SERIAL PRIMARY KEY)
- user_id (INTEGER, FOREIGN KEY to users.id)
- attendance_date (DATE, DEFAULT CURRENT_DATE)
- check_in_time (TIME)
- check_out_time (TIME)
- status (VARCHAR, DEFAULT 'absent')
- notes (TEXT)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- UNIQUE constraint on (user_id, attendance_date)
```

The system now provides a complete attendance tracking solution with database persistence and real-time updates!