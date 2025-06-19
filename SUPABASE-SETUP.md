# Supabase Setup Guide

## 1. Get Your Supabase Connection Details

1. Go to your [Supabase Dashboard](https://app.supabase.com)
2. Select your project
3. Go to **Settings** → **Database**
4. Find your connection details:
   - **Host**: `db.xxxxxxxxxxxxxxxxxxxx.supabase.co`
   - **Database name**: `postgres` (default)
   - **Port**: `5432`
   - **User**: `postgres`
   - **Password**: Your database password

## 2. Create the Property Detail Table

1. In Supabase Dashboard, go to **SQL Editor**
2. Run this SQL to create the table:

```sql
-- Create the property_detail table
CREATE TABLE property_detail (
  id SERIAL PRIMARY KEY,
  address TEXT NOT NULL,
  offer_decision TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create an index for faster queries
CREATE INDEX idx_offer_decision ON property_detail(offer_decision);

-- Enable Row Level Security (recommended)
ALTER TABLE property_detail ENABLE ROW LEVEL SECURITY;

-- Create a policy to allow all operations
-- (Adjust this based on your security needs)
CREATE POLICY "Allow all operations" ON property_detail
  FOR ALL USING (true);
```

## 3. Configure the Monitor

1. Copy the example environment file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` with your Supabase details:
   ```env
   # Supabase Database Configuration
   DB_TYPE=postgresql
   DB_HOST=db.xxxxxxxxxxxxxxxxxxxx.supabase.co
   DB_PORT=5432
   DB_NAME=postgres
   DB_USER=postgres
   DB_PASSWORD=your-database-password-here
   ```

   **OR** use the connection string (found in Database Settings):
   ```env
   DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.[YOUR-PROJECT-REF].supabase.co:5432/postgres
   ```

## 4. Test the Connection

Run the Supabase-specific monitor:
```bash
node monitor-property-changes-supabase.js
```

You should see:
```
✅ Connected to Supabase successfully!
   Server time: 2024-01-15T...
✅ Loaded 0 properties into memory
```

## 5. Insert Test Data

To test the system, insert some data in Supabase:

1. Go to **Table Editor** in Supabase
2. Select `property_detail` table
3. Insert a row with:
   - `address`: "123 Test Street, New York, NY 10001"
   - `offer_decision`: NULL (or leave empty)

4. After the monitor is running, update the row:
   - Change `offer_decision` from NULL to "BUY"

5. The monitor should detect this and create a spreadsheet!

## 6. Using Supabase Realtime (Optional)

For instant updates instead of polling, you can enable Supabase Realtime:

1. In Supabase Dashboard, go to **Database** → **Replication**
2. Enable replication for the `property_detail` table
3. Select "Send" for UPDATE events

## Troubleshooting

### Connection Issues
- Ensure your password doesn't contain special characters that need URL encoding
- Check that your project is not paused (free tier pauses after 1 week of inactivity)
- Verify SSL is enabled (the monitor includes `ssl: { rejectUnauthorized: false }`)

### Table Not Found
- Make sure you created the table in the `public` schema
- Check that Row Level Security policies allow access

### No Changes Detected
- Verify the `offer_decision` column is exactly "BUY" (case-sensitive)
- Check that the previous value was NULL, not an empty string

## SQL Queries for Testing

```sql
-- Insert test property
INSERT INTO property_detail (address, offer_decision)
VALUES ('456 Example Ave, Boston, MA 02134', NULL);

-- Update to trigger the monitor
UPDATE property_detail 
SET offer_decision = 'BUY'
WHERE address = '456 Example Ave, Boston, MA 02134';

-- View all properties
SELECT * FROM property_detail;

-- View only BUY decisions
SELECT * FROM property_detail WHERE offer_decision = 'BUY';
```