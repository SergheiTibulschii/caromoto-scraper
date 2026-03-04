# Redis Storage Flow - Visual Diagram

## Single Key Storage Strategy

```
┌─────────────────────────────────────────────────────────────────────┐
│                         REDIS STORAGE                               │
│  Key: caromoto:scraping:cars                                        │
│  Value: { data: [25 cars], timestamp, carsCount, ... }             │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Flow Diagram

### **Run #1 - Initial Scrape** (Redis is empty)

```
┌──────────────┐
│   REDIS      │
│   (empty)    │
└──────────────┘
       │
       ▼
┌──────────────┐
│   SCRAPE     │──────► Fetch 25 cars from website
│   Website    │
└──────────────┘
       │
       ▼
   [Car A, Car B, Car C, ... Car Y]  (25 cars)
       │
       ▼  (No comparison - nothing to compare with)
       │
       ▼
┌──────────────────────────────┐
│   SAVE TO REDIS              │
│   Replace entire key         │
│   Cars: [A,B,C,...Y] (25)    │
└──────────────────────────────┘
```

**Result**: No notifications sent (first run)

---

### **Run #2 - First Comparison**

```
┌────────────────────────────┐
│   GET FROM REDIS           │
│   Stored: [A,B,C,...Y]     │ ◄── 25 cars from Run #1
└────────────────────────────┘
       │
       │  (Step 1: Get stored cars)
       │
       ▼
┌──────────────┐
│   SCRAPE     │──────► Fetch 25 cars from website
│   Website    │
└──────────────┘
       │
       │  (Step 2: Scrape new cars)
       │
       ▼
   [Car C, Car D, Car E, ... Car Z, Car AA]  (25 cars)
       │
       │  (Step 3: Compare by vehicleId)
       │
       ▼
┌────────────────────────────────────────┐
│   COMPARISON                           │
│                                        │
│   Stored:  [A,B,C,D,...Y]             │
│   Scraped: [C,D,E,F,...Z,AA]          │
│                                        │
│   NEW: [E,F,...Z,AA]  (not in Redis)  │
└────────────────────────────────────────┘
       │
       │  (Step 4: Identify new cars)
       │
       ▼
┌────────────────────────────────────────┐
│   SEND NOTIFICATIONS                   │
│   - Fetch details for new cars         │
│   - Send Telegram message for each     │
└────────────────────────────────────────┘
       │
       │  (Step 5: Notify)
       │
       ▼
┌────────────────────────────────────────┐
│   REPLACE REDIS                        │
│   Old: [A,B,C,...Y]                    │
│   New: [C,D,E,...Z,AA]                 │
└────────────────────────────────────────┘
```

**Result**: Notifications sent for new cars (E,F,...Z,AA)

---

### **Run #3 - Subsequent Run (No New Cars)**

```
┌────────────────────────────┐
│   GET FROM REDIS           │
│   Stored: [C,D,E,...Z,AA]  │ ◄── 25 cars from Run #2
└────────────────────────────┘
       │
       ▼
┌──────────────┐
│   SCRAPE     │──────► Fetch 25 cars from website
│   Website    │
└──────────────┘
       │
       ▼
   [Car C, Car D, Car E, ... Car Z, Car AA]  (same 25 cars)
       │
       ▼
┌────────────────────────────────────────┐
│   COMPARISON                           │
│                                        │
│   Stored:  [C,D,E,...Z,AA]            │
│   Scraped: [C,D,E,...Z,AA]            │
│                                        │
│   NEW: []  (no new cars)              │
└────────────────────────────────────────┘
       │
       │  (No new cars found)
       │
       ▼
   (Skip notifications)
       │
       ▼
┌────────────────────────────────────────┐
│   REPLACE REDIS                        │
│   Old: [C,D,E,...Z,AA]                 │
│   New: [C,D,E,...Z,AA]  (same)         │
└────────────────────────────────────────┘
```

**Result**: No notifications (no new cars)

---

### **Run #4 - With New Cars**

```
┌────────────────────────────┐
│   GET FROM REDIS           │
│   Stored: [C,D,E,...Z,AA]  │
└────────────────────────────┘
       │
       ▼
┌──────────────┐
│   SCRAPE     │
│   Website    │
└──────────────┘
       │
       ▼
   [Car D, Car E, Car F, ... Car AA, Car AB, Car AC]  (25 cars)
       │
       ▼
┌────────────────────────────────────────┐
│   COMPARISON                           │
│                                        │
│   Stored:  [C,D,E,...Z,AA]            │
│   Scraped: [D,E,F,...AA,AB,AC]        │
│                                        │
│   NEW: [AB, AC]  (not in Redis)       │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│   SEND NOTIFICATIONS                   │
│   - 2 new cars: AB, AC                 │
└────────────────────────────────────────┘
       │
       ▼
┌────────────────────────────────────────┐
│   REPLACE REDIS                        │
│   New: [D,E,F,...AA,AB,AC]             │
└────────────────────────────────────────┘
```

**Result**: 2 notifications sent (for AB and AC)

---

## Key Points

### ✅ Always Exactly 25 Cars in Redis
- Each scrape fetches 25 cars
- Each save replaces all 25 cars
- No accumulation, no history

### ✅ Comparison by vehicleId
```javascript
// Pseudocode
storedIds = [stored cars].map(car => car.vehicleId)
scrapedCars = [scraped 25 cars]

newCars = scrapedCars.filter(car => 
  !storedIds.includes(car.vehicleId)
)
```

### ✅ Order of Operations
1. **GET** stored cars from Redis (or null if empty)
2. **SCRAPE** 25 new cars from website
3. **COMPARE** scraped vs stored (if stored exists)
4. **NOTIFY** for new cars (if any)
5. **REPLACE** Redis with scraped cars

### ✅ First Run Special Case
- Redis is empty
- Skip comparison step
- Save scraped cars
- No notifications

---

## Redis Key Structure

```
caromoto:scraping:cars
{
  "id": "scraping_1709564832000",
  "timestamp": "2026-03-04T10:00:32.000Z",
  "carsCount": 25,
  "loadTime": 1234,
  "data": [
    {
      "vehicleId": "ABC123",
      "auctionCode": "XYZ",
      "make": "Mercedes",
      "model": "GLE 350",
      ...
    },
    ... (24 more cars)
  ]
}
```

---

## Comparison Logic Example

### Stored in Redis (25 cars)
```json
[
  { "vehicleId": "001", "model": "GLE 350" },
  { "vehicleId": "002", "model": "GLE 400" },
  { "vehicleId": "003", "model": "GLE 450" },
  ...
  { "vehicleId": "025", "model": "GLE 350" }
]
```

### Scraped from Website (25 cars)
```json
[
  { "vehicleId": "003", "model": "GLE 450" },  ← In Redis
  { "vehicleId": "004", "model": "GLE 350" },  ← In Redis
  { "vehicleId": "005", "model": "GLE 400" },  ← In Redis
  ...
  { "vehicleId": "026", "model": "GLE 350" },  ← NEW!
  { "vehicleId": "027", "model": "GLE 450" }   ← NEW!
]
```

### Result
- **New Cars**: `vehicleId` 026, 027 (not in stored set)
- **Notifications**: 2 Telegram messages sent
- **Redis Updated**: All 25 scraped cars replace stored cars

---

## Error Handling

### If Scraping Fails
```
Attempt 1 ──X──► Retry (wait 2s)
Attempt 2 ──X──► Retry (wait 2s)
Attempt 3 ──X──► Log error & exit
                 (Redis unchanged)
```

### If Comparison Fails
- Skip notifications
- Still replace Redis with scraped data
- Log error for debugging

### If Telegram Fails
- Log error
- Continue with Redis replacement
- Don't block the job

---

## Summary

**Simple & Efficient**:
- ✅ Single Redis key
- ✅ Fixed 25-car limit
- ✅ Complete replacement each run
- ✅ Compare by vehicleId
- ✅ Notify only new cars
- ✅ No cleanup needed
