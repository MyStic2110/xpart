// Rain forecast for the planner via Open-Meteo (free, keyless — no connector
// needed). Best-effort: any failure degrades to null and the calendar renders
// without weather rather than erroring. Results cached in memory per city.

export interface DayWeather {
  date: string;
  rainProbability: number; // 0-100, daily max
  tempMax: number; // °C
  summary: string;
}

interface CacheEntry {
  fetchedAt: number;
  days: DayWeather[];
}

const cache = new Map<string, CacheEntry>();
const CACHE_TTL_MS = 3 * 60 * 60 * 1000; // 3h — forecasts don't move faster

// WMO weather code → short human summary (subset that matters for a car wash).
function describe(code: number, rainProb: number): string {
  if (code >= 95) return "Thunderstorm";
  if (code >= 80) return "Rain showers";
  if (code >= 61) return "Rain";
  if (code >= 51) return "Drizzle";
  if (code >= 45) return "Fog";
  if (rainProb >= 60) return "Rain likely";
  if (code >= 2) return "Cloudy";
  return "Clear";
}

// Coordinates for major Indian cities — avoids the geocoding API entirely for
// the common case (its subdomain is DNS-flaky on some Indian ISPs).
const CITY_COORDS: Record<string, { latitude: number; longitude: number }> = {
  chennai: { latitude: 13.08, longitude: 80.27 },
  bengaluru: { latitude: 12.97, longitude: 77.59 },
  bangalore: { latitude: 12.97, longitude: 77.59 },
  mumbai: { latitude: 19.08, longitude: 72.88 },
  delhi: { latitude: 28.61, longitude: 77.21 },
  "new delhi": { latitude: 28.61, longitude: 77.21 },
  hyderabad: { latitude: 17.39, longitude: 78.49 },
  kolkata: { latitude: 22.57, longitude: 88.36 },
  pune: { latitude: 18.52, longitude: 73.86 },
  ahmedabad: { latitude: 23.02, longitude: 72.57 },
  jaipur: { latitude: 26.91, longitude: 75.79 },
  coimbatore: { latitude: 11.02, longitude: 76.96 },
  madurai: { latitude: 9.93, longitude: 78.12 },
  trichy: { latitude: 10.79, longitude: 78.7 },
  tiruchirappalli: { latitude: 10.79, longitude: 78.7 },
  salem: { latitude: 11.66, longitude: 78.15 },
  kochi: { latitude: 9.93, longitude: 76.27 },
  thiruvananthapuram: { latitude: 8.52, longitude: 76.94 },
  visakhapatnam: { latitude: 17.69, longitude: 83.22 },
  vijayawada: { latitude: 16.51, longitude: 80.65 },
  nagpur: { latitude: 21.15, longitude: 79.09 },
  indore: { latitude: 22.72, longitude: 75.86 },
  lucknow: { latitude: 26.85, longitude: 80.95 },
  chandigarh: { latitude: 30.73, longitude: 76.78 },
  surat: { latitude: 21.17, longitude: 72.83 },
  vellore: { latitude: 12.92, longitude: 79.13 },
  pondicherry: { latitude: 11.94, longitude: 79.81 },
  puducherry: { latitude: 11.94, longitude: 79.81 },
};

async function resolveCoords(city: string): Promise<{ latitude: number; longitude: number } | null> {
  const known = CITY_COORDS[city.trim().toLowerCase()];
  if (known) return known;
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
      { signal: AbortSignal.timeout(4000) }
    );
    if (!geoRes.ok) return null;
    const geo = (await geoRes.json()) as { results?: { latitude: number; longitude: number }[] };
    return geo.results?.[0] ?? null;
  } catch {
    return null;
  }
}

export async function getRainForecast(city: string): Promise<DayWeather[] | null> {
  const key = city.trim().toLowerCase();
  const hit = cache.get(key);
  if (hit && Date.now() - hit.fetchedAt < CACHE_TTL_MS) return hit.days;

  try {
    const loc = await resolveCoords(city);
    if (!loc) return hit?.days ?? null;

    const wxRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${loc.latitude}&longitude=${loc.longitude}` +
        `&daily=precipitation_probability_max,weathercode,temperature_2m_max&forecast_days=16&timezone=Asia%2FKolkata`
    );
    if (!wxRes.ok) return hit?.days ?? null;
    const wx = (await wxRes.json()) as {
      daily?: { time: string[]; precipitation_probability_max: (number | null)[]; weathercode: number[]; temperature_2m_max: number[] };
    };
    if (!wx.daily) return hit?.days ?? null;

    const days: DayWeather[] = wx.daily.time.map((date, i) => {
      const rainProb = wx.daily!.precipitation_probability_max[i] ?? 0;
      const code = wx.daily!.weathercode[i] ?? 0;
      return { date, rainProbability: rainProb, tempMax: Math.round(wx.daily!.temperature_2m_max[i] ?? 0), summary: describe(code, rainProb) };
    });

    cache.set(key, { fetchedAt: Date.now(), days });
    return days;
  } catch {
    return hit?.days ?? null; // offline / DNS blocked → stale cache or nothing
  }
}
