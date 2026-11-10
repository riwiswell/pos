import { useEffect, useState } from "react";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow,
  CloudSun, Droplets, LocateFixed, MapPin, RefreshCw, Sun, Wind,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type City = { id: string; label: string; latitude: number; longitude: number };
type LocationChoice = City | { id: "current"; label: string; latitude: number; longitude: number };

type WeatherResponse = {
  current?: {
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    precipitation_probability_max?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
  };
};

const CITIES: City[] = [
  { id: "buenaventura", label: "Buenaventura", latitude: 3.8801, longitude: -77.0312 },
  { id: "cali", label: "Cali", latitude: 3.4516, longitude: -76.532 },
  { id: "bogota", label: "Bogotá", latitude: 4.711, longitude: -74.0721 },
  { id: "medellin", label: "Medellín", latitude: 6.2442, longitude: -75.5812 },
  { id: "barranquilla", label: "Barranquilla", latitude: 10.9685, longitude: -74.7813 },
  { id: "cartagena", label: "Cartagena", latitude: 10.391, longitude: -75.4794 },
];

const STORAGE_KEY = "personal-os:weather-location";

function readLocation(): LocationChoice {
  if (typeof window === "undefined") return CITIES[0];
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved) as LocationChoice;
      if (parsed.id === "current" && Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) return parsed;
      const city = CITIES.find((item) => item.id === parsed.id);
      if (city) return city;
    }
  } catch {
    // Ignore malformed local preferences and use the safe default.
  }
  return CITIES[0];
}

function weatherDescription(code: number) {
  if (code === 0) return "Despejado";
  if ([1, 2].includes(code)) return "Parcialmente nublado";
  if (code === 3) return "Nublado";
  if ([45, 48].includes(code)) return "Neblina";
  if ([51, 53, 55, 56, 57].includes(code)) return "Llovizna";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Lluvia";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Nieve";
  if ([95, 96, 99].includes(code)) return "Tormenta";
  return "Condiciones variables";
}

function WeatherIcon({ code, isDay }: { code: number; isDay: boolean }) {
  const className = "h-12 w-12 text-primary";
  if (code === 0) return isDay ? <Sun className={className} /> : <Cloud className={className} />;
  if ([1, 2].includes(code)) return <CloudSun className={className} />;
  if (code === 3 || [45, 48].includes(code)) return code === 3 ? <Cloud className={className} /> : <CloudFog className={className} />;
  if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle className={className} />;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return <CloudRain className={className} />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow className={className} />;
  if ([95, 96, 99].includes(code)) return <CloudLightning className={className} />;
  return <Cloud className={className} />;
}

export function WeatherCard() {
  const [location, setLocation] = useState<LocationChoice>(readLocation);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [locating, setLocating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m,is_day",
      daily: "weather_code,precipitation_probability_max,temperature_2m_max,temperature_2m_min",
      forecast_days: "5",
      timezone: "auto",
    });
    fetch("https://api.open-meteo.com/v1/forecast?" + params.toString(), { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("El servicio del clima no respondió.");
        return response.json() as Promise<WeatherResponse>;
      })
      .then((data) => {
        if (active) setWeather(data);
      })
      .catch((cause: unknown) => {
        if (!active || (cause instanceof Error && cause.name === "AbortError")) return;
        setError(cause instanceof Error ? cause.message : "No se pudo consultar el clima.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [location]);

  const chooseCity = (id: string) => {
    const city = CITIES.find((item) => item.id === id);
    if (!city) return;
    setLocation(city);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(city));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setError("Este dispositivo no permite consultar la ubicación.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current: LocationChoice = {
          id: "current",
          label: "Mi ubicación",
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        setLocation(current);
        setLocating(false);
      },
      () => {
        setError("No se pudo obtener la ubicación. Revisa el permiso del navegador o elige una ciudad.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 },
    );
  };

  const current = weather?.current;
  const rainChance = weather?.daily?.precipitation_probability_max?.[0];

  return (
    <section className="glass overflow-hidden rounded-2xl border border-border/70 p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary"><CloudSun className="h-5 w-5" /></span>
          <div>
            <h2 className="font-semibold">Clima</h2>
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{location.label}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Ciudad para consultar el clima"
            className="h-9 max-w-[150px] rounded-lg border border-input bg-background px-2 text-xs"
            value={location.id === "current" ? "current" : location.id}
            onChange={(event) => chooseCity(event.target.value)}
          >
            <option value="current" disabled>Mi ubicación</option>
            {CITIES.map((city) => <option key={city.id} value={city.id}>{city.label}</option>)}
          </select>
          <Button type="button" size="sm" variant="outline" className="h-9 gap-1.5" onClick={useCurrentLocation} disabled={locating}>
            <LocateFixed className="h-3.5 w-3.5" />{locating ? "Ubicando…" : "Dónde estoy"}
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="mt-5 flex items-center gap-3 text-sm text-muted-foreground"><RefreshCw className="h-4 w-4 animate-spin" />Consultando el clima…</div>
      ) : error ? (
        <div className="mt-4 rounded-xl border border-dashed border-border p-3">
          <p className="text-sm text-muted-foreground">{error}</p>
          <Button type="button" size="sm" variant="ghost" className="mt-1 px-0" onClick={() => setLocation((value) => ({ ...value }))}>Intentar de nuevo</Button>
        </div>
      ) : current ? (
        <div className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-[1.25fr_1fr_1fr_1fr] sm:items-center">
          <div className="col-span-2 flex items-center gap-4 sm:col-span-1">
            <WeatherIcon code={current.weather_code} isDay={current.is_day === 1} />
            <div>
              <p className="text-4xl font-semibold tracking-tight tabular-nums">{Math.round(current.temperature_2m)}°</p>
              <p className="text-sm text-muted-foreground">{weatherDescription(current.weather_code)}</p>
              <p className="text-xs text-muted-foreground">Sensación {Math.round(current.apparent_temperature)}°</p>
            </div>
          </div>
          <div className="rounded-xl bg-background/55 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5" />Prob. de lluvia</div>
            <p className="mt-1 text-xl font-semibold tabular-nums">{rainChance ?? "—"}{rainChance == null ? "" : "%"}</p>
          </div>
          <div className="rounded-xl bg-background/55 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wind className="h-3.5 w-3.5" />Viento</div>
            <p className="mt-1 text-xl font-semibold tabular-nums">{Math.round(current.wind_speed_10m)} <span className="text-xs font-normal">km/h</span></p>
          </div>
          <div className="rounded-xl bg-background/55 p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5" />Humedad</div>
            <p className="mt-1 text-xl font-semibold tabular-nums">{Math.round(current.relative_humidity_2m)}%</p>
          </div>
        </div>
      ) : null}
      {weather?.daily?.time && (
        <div className="mt-5 grid grid-cols-5 gap-2 border-t border-border/70 pt-4">
          {weather.daily.time.map((day, index) => (
            <div key={day} className="min-w-0 rounded-xl bg-background/45 px-1.5 py-2 text-center">
              <p className="text-[10px] capitalize text-muted-foreground">
                {index === 0 ? "Hoy" : new Intl.DateTimeFormat("es-CO", { weekday: "short" }).format(new Date(day + "T12:00:00"))}
              </p>
              <p className="my-1 text-base" aria-label={weatherDescription(weather.daily?.weather_code?.[index] ?? 0)}>
                {([0, 1, 2].includes(weather.daily?.weather_code?.[index] ?? -1) ? "🌤️" :
                  [61, 63, 65, 80, 81, 82, 95, 96, 99].includes(weather.daily?.weather_code?.[index] ?? -1) ? "🌧️" : "☁️")}
              </p>
              <p className="text-xs font-semibold tabular-nums">
                {Math.round(weather.daily?.temperature_2m_max?.[index] ?? 0)}° <span className="font-normal text-muted-foreground">{Math.round(weather.daily?.temperature_2m_min?.[index] ?? 0)}°</span>
              </p>
              <p className="mt-1 text-[10px] text-muted-foreground tabular-nums">
                {weather.daily?.precipitation_probability_max?.[index] ?? "—"}%
              </p>
            </div>
          ))}
        </div>
      )}
      <p className="mt-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground">Datos meteorológicos de Open-Meteo. La ubicación del dispositivo solo se consulta cuando pulsas «Dónde estoy».</p>
    </section>
  );
}
