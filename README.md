# RainCheck

A small installable weather app that answers one question: **will it rain?**

Open it on your phone, glance at the top card, and you know whether to take an umbrella.

## What you see

- **Verdict at the top** — `NO rain`, `Rain in ~X min`, or `YES — raining`, with current temperature and cloud cover.
- **Next 2 hours** — 8 bars in 15-minute steps showing expected rain in mm, plus the 2-hour total.
- **Radar, last ~60 minutes** — live rain radar map around your location. Drag the slider to scrub, press Play to animate. Blue → red means light → heavy rain.
- **Next 8 hours** — hourly cards with rain amount, rain probability, temperature, total cloud cover, and low / mid / high cloud split. You can switch the forecast model (Best match, ALADIN, ICON-EU, ECMWF, GFS).

Location defaults to Craiova (44.33, 23.80). Change lat/lon manually or tap 📍 to use your phone's location. Your choice is saved on the device.

## How it works

No accounts, no API keys. All data comes from free, open sources straight in the browser:

- **Forecasts (2h + 8h):** [Open-Meteo](https://open-meteo.com/) — combines models like ICON, GFS, ECMWF and CHMI ALADIN. The app asks for `minutely_15` precipitation for the short-term view and `hourly` rain + cloud layers for the 8-hour view.
- **Radar:** [RainViewer](https://www.rainviewer.com/api.html) — real radar composites (EUMETNET OPERA network), shown as animated map tiles.

Forecasts refresh automatically every 10 minutes. The app shell works offline once installed; forecast and radar need internet.

## Install on your phone

RainCheck is a PWA — it installs like a native app from the browser:

- **Android (Chrome):** open the app URL → menu ⋮ → *Add to Home screen* / *Install app*.
- **iPhone (Safari):** open the app URL → Share → *Add to Home Screen*.

Icons are provided in all sizes phones need: 180px (iOS), 192px, 512px, and a maskable 512px icon for Android adaptive icons.

## Run it yourself

Any static server works (service worker needs `http`, not `file://`):

```powershell
npx serve .
```

Then open the shown URL, e.g. http://localhost:3000.
