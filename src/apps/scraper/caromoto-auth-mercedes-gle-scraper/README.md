# Mercedes GLE 350 2020-2021 Scraper

Production script for scraping Mercedes GLE vehicles (2020-2021) from Caromoto.

## Features

- Authenticates with Caromoto
- Searches for Mercedes-Benz GLE 350 models from 2020-2021
- Extracts only the cars data (`result.searchModel.cars`)
- Saves results to timestamped JSON files
- Automatic output directory creation

## Usage

### Run the script

```bash
npm run scrape:gle
```

### With custom credentials (optional)

```bash
CAROMOTO_EMAIL="your@email.com" CAROMOTO_PASSWORD="yourpassword" npm run scrape:gle
```

### Direct execution

```bash
npx ts-node src/apps/scraper/caromoto-auth-mercedes-gle-scraper/index.ts
```

## Output

Results are saved to:

```
src/apps/scraper/caromoto-auth-mercedes-gle-scraper/output/
```

### File naming format

```
GLE-350-2020-2021_DD_MM_YYYY_HH_MM_SS.json
```

Example:

```
GLE-350-2020-2021_01_03_2026_14_30_45.json
```

## Configuration

### Environment Variables

- `CAROMOTO_EMAIL` - Caromoto login email (default: moldex.dan@gmail.com)
- `CAROMOTO_PASSWORD` - Caromoto login password (default: 446236)

### Search Parameters

The script searches for vehicles with these filters:

- **Make**: Mercedes-Benz
- **Model**: GLE
- **Year**: 2020-2021
- **Odometer**: < 150,000 km
- **Engine**: 4-cylinder turbo
- **Drive Train**: 4x4

## Output Format

The saved JSON file contains an array of car objects with details like:

- Vehicle ID
- Make, model, year
- Price
- Mileage
- Location
- Images
- And more...
