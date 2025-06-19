# Property Monitor & HouseCanary Spreadsheet Updater

This system monitors a database table for property offer decisions and automatically updates HouseCanary spreadsheets when a property's offer_decision changes from NULL to "BUY".

## Setup

1. **Configure Database Connection**
   ```bash
   cp .env.example .env
   ```
   Edit `.env` with your database credentials:
   - Set `DB_TYPE` to either `postgresql` or `mysql`
   - Configure host, port, database name, username, and password
   - Set poll interval (default: 30 seconds)

2. **Ensure HouseCanary Template Exists**
   The template file should be at: `./downloads/sample_dexp_input.xlsx`

## Usage

### Automatic Database Monitoring
```bash
node monitor-property-changes.js
```

This will:
- Connect to your database
- Check the `property_detail` table every 30 seconds
- When `offer_decision` changes from NULL to "BUY":
  - Extract the address
  - Create a new spreadsheet with:
    - Rows 2 and 3 deleted from template
    - Street address in column B
    - Zipcode in column C
  - Save to `./output/property_[timestamp].xlsx`

### Manual Testing (No Database Required)

1. **Test the spreadsheet functionality:**
   ```bash
   node test-spreadsheet.js
   ```

2. **Manually create a spreadsheet with an address:**
   ```bash
   node manual-update-spreadsheet.js "123 Main St, New York, NY 10001"
   ```

## Output

- Spreadsheets are saved to `./output/` directory
- Changes are logged to `./output/changes.log`
- Each file is timestamped

## Database Table Structure

Expected `property_detail` table structure:
```sql
CREATE TABLE property_detail (
    id INT PRIMARY KEY,
    address VARCHAR(255),
    offer_decision VARCHAR(50),
    -- other columns...
);
```

## Troubleshooting

1. **Database Connection Issues**
   - Check credentials in `.env`
   - Ensure database is running
   - Verify table name is `property_detail`

2. **Template File Not Found**
   - Run the HouseCanary downloader first
   - Check file exists at `./downloads/sample_dexp_input.xlsx`

3. **Address Parsing Issues**
   - The parser expects format: "Street, City, State ZIP"
   - ZIP codes are extracted using regex: `\d{5}(-\d{4})?`

## Logs

- Console output shows all detected changes
- `./output/changes.log` contains JSON entries for each transition
- Error messages indicate connection or parsing issues