# RainCheck — Will it rain? (PWA, no API key)

Clean installable PWA that replaces your 3-tab cmd script with one view:

| Your old tab | Replacement in app | Free data, no key |
|---|---|---|
| Ventusky EURAD radar (next ~1h, 10-min steps) | Radar card: RainViewer tiles + play/scrub | `api.rainviewer.com` (EUMETNET OPERA composites ≈ EURAD) |
| Ventusky Aladin 1h precipitation (next 8h rain + clouds) | 8-hour cards: rain mm, probability, total/low/mid/high cloud, model picker incl. **CHMI ALADIN 2km** | `api.open-meteo.com` hourly + `models=chmi_aladin_seamless,icon_eu,ecmwf_ifs,gfs` |
| AccuWeather MinuteCast (next 2h) | Minutecast card: 8× 15-min bars + “Rain in ~X min” verdict | `api.open-meteo.com` `minutely_15` precipitation (opt-in true AccuWeather if you paste a free key, 50 calls/day) |

## Run

Any static server (service worker needs http, not file://):

```powershell
cd E:\repos\RainCheck
npx serve .
# or
python -m http.server 8000
```

Open http://localhost:3000 (or :8000) → Add to Home Screen for PWA.

## Notes

- Default location 44.33, 23.80 (Craiova). Editable + 📍 geolocation, saved in localStorage.
- Ventusky has no public API — we use the same underlying open data (ALADIN via Open-Meteo, radar via OPERA/RainViewer) instead of scraping.
- AccuWeather MinuteCast API is key-only (`dataservice.accuweather.com/forecasts/v1/minute?q=lat,lon&apikey=KEY`); the app works without it and shows the official phrase if you add a key.
- Offline: app shell cached by `sw.js`; forecast/radar need network.
