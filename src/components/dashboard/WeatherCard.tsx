import { useEffect, useState } from "react";
import {
  Cloud, CloudDrizzle, CloudFog, CloudLightning, CloudRain, CloudSnow,
  CloudSun, Droplets, MapPin, RefreshCw, Sun, Wind,
} from "lucide-react";

import { Button } from "@/components/ui/button";

type City = { id: string; label: string; latitude: number; longitude: number };
type LocationChoice = City | { id: "current"; label: string; latitude: number; longitude: number };

type WeatherResponse = {
  current?: {
    time: string;
    interval?: number;
    temperature_2m: number;
    apparent_temperature: number;
    relative_humidity_2m: number;
    precipitation: number;
    rain?: number;
    showers?: number;
    cloud_cover?: number;
    weather_code: number;
    wind_speed_10m: number;
    is_day: number;
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

function currentConditionCode(current: NonNullable<WeatherResponse["current"]>):number {
  const rainCodes = [51,53,55,56,57,61,63,65,66,67,80,81,82];
  if (!rainCodes.includes(current.weather_code)) return current.weather_code;

  // Open-Meteo's weather code can describe a modeled rainy condition even when
  // the active precipitation interval is dry. Use the measured/modelled amount
  // for this interval to avoid showing "Lluvia" for hours without rain.
  const ageMinutes = current.time
    ? Math.max(0, (Date.now() - new Date(current.time).getTime()) / 60000)
    : 0;
  const intervalRain = Math.max(
    Number(current.rain ?? 0),
    Number(current.showers ?? 0),
    Number(current.precipitation ?? 0),
  );
  if (ageMinutes <= 90 && intervalRain >= 0.1) return current.weather_code;

  const cloudCover = Number(current.cloud_cover ?? 100);
  if (cloudCover <= 15) return current.is_day === 1 ? 0 : 0;
  if (cloudCover <= 45) return 2;
  return 3;
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

function weatherMood(code: number, isDay: boolean) {
  if (code === 0) return isDay ? "clear" : "night";
  if ([1, 2].includes(code)) return "partly-cloudy";
  if (code === 3) return "cloudy";
  if ([45, 48].includes(code)) return "fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "snow";
  if ([95, 96, 99].includes(code)) return "storm";
  return "cloudy";
}

function WeatherIcon({ code, isDay, small = false }: { code: number; isDay: boolean; small?: boolean }) {
  const className = small ? "h-10 w-10 text-white" : "h-12 w-12 text-white";
  if (code === 0) return isDay ? <Sun className={className} /> : <Cloud className={className} />;
  if ([1, 2].includes(code)) return <CloudSun className={className} />;
  if (code === 3 || [45, 48].includes(code)) return code === 3 ? <Cloud className={className} /> : <CloudFog className={className} />;
  if ([51, 53, 55, 56, 57].includes(code)) return <CloudDrizzle className={className} />;
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return <CloudRain className={className} />;
  if ([71, 73, 75, 77, 85, 86].includes(code)) return <CloudSnow className={className} />;
  if ([95, 96, 99].includes(code)) return <CloudLightning className={className} />;
  return <Cloud className={className} />;
}

export function WeatherCard({ compact = false, planner = false }: { compact?: boolean; planner?: boolean } = {}) {
  const [location, setLocation] = useState<LocationChoice>(CITIES[0]);
  const [weather, setWeather] = useState<WeatherResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      latitude: String(location.latitude),
      longitude: String(location.longitude),
      current: "temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,rain,showers,cloud_cover,weather_code,wind_speed_10m,is_day",
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
  }, [location, planner, refreshKey]);

  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const current: LocationChoice = { id: "current", label: "Mi ubicación", latitude: position.coords.latitude, longitude: position.coords.longitude };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
        setLocation(current);
      },
      () => { /* Keep Buenaventura as the default when location permission is unavailable. */ },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 15 * 60 * 1000 },
    );
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setRefreshKey((value) => value + 1), 5 * 60 * 1000);
    return () => window.clearInterval(timer);
  }, []);

  const current = weather?.current;
  const displayCode = current ? currentConditionCode(current) : 3;
  const mood = current ? weatherMood(displayCode, current.is_day === 1) : "neutral";

  return (
    <section className={`glass weather-card weather-card--${mood} overflow-hidden rounded-2xl border border-border/70 ${compact || planner ? "p-3" : "p-4 sm:p-5"}`}>
      <div className="weather-card__content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className={`flex items-center justify-center rounded-xl bg-primary/10 text-primary ${planner ? "h-8 w-8" : "h-9 w-9"}`}><CloudSun className={planner ? "h-4 w-4" : "h-5 w-5"} /></span>
          <div>
            <h2 className={planner ? "text-sm font-semibold" : "font-semibold"}>Clima</h2>
            <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{location.label}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <span>Ubicación automática</span>
          <Button type="button" size="icon" variant="outline" className="h-8 w-8" onClick={() => setRefreshKey((value) => value + 1)} disabled={loading} aria-label="Actualizar clima" title="Actualizar clima">
            <RefreshCw className={loading ? "h-3.5 w-3.5 animate-spin" : "h-3.5 w-3.5"} />
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
      ) : current ? (compact ? (
          <div className="mt-3 grid min-w-0 grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="col-span-2 flex min-w-0 items-center gap-3 rounded-xl bg-background/35 p-2 sm:col-span-2">
              <WeatherIcon code={displayCode} isDay={current.is_day === 1} />
              <div className="min-w-0">
                <p className="text-3xl font-semibold tracking-tight tabular-nums">{Math.round(current.temperature_2m)}°</p>
                <p className="break-words text-xs text-muted-foreground">{weatherDescription(displayCode)} · sensación {Math.round(current.apparent_temperature)}°</p>
              </div>
            </div>
            <div className="min-w-0 rounded-xl bg-background/55 px-3 py-2"><p className="text-[10px] text-muted-foreground">Lluvia ahora</p><p className="text-lg font-semibold tabular-nums">{Number(current.precipitation).toFixed(1)} <span className="text-xs font-normal">mm</span></p></div>
            <div className="min-w-0 rounded-xl bg-background/55 px-3 py-2"><p className="text-[10px] text-muted-foreground">Humedad</p><p className="text-lg font-semibold tabular-nums">{Math.round(current.relative_humidity_2m)}%</p></div>
          </div>
        ) : (
          <div className={planner ? "mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-center" : "mt-5 grid grid-cols-2 gap-4 sm:grid-cols-[1.25fr_1fr_1fr_1fr] sm:items-center"}>
            <div className="col-span-2 flex items-center gap-3 sm:col-span-1">
              <WeatherIcon code={displayCode} isDay={current.is_day === 1} small={planner} />
              <div>
                <p className={planner ? "text-3xl font-semibold tracking-tight tabular-nums" : "text-4xl font-semibold tracking-tight tabular-nums"}>{Math.round(current.temperature_2m)}°</p>
                <p className="text-sm text-muted-foreground">{weatherDescription(displayCode)}</p>
                <p className="text-xs text-muted-foreground">Sensación {Math.round(current.apparent_temperature)}°</p>
              </div>
            </div>
            <div className={planner ? "rounded-xl bg-background/55 p-2" : "rounded-xl bg-background/55 p-3"}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5" />Lluvia ahora</div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{Number(current.precipitation).toFixed(1)} <span className="text-xs font-normal">mm</span></p>
            </div>
            <div className={planner ? "rounded-xl bg-background/55 p-2" : "rounded-xl bg-background/55 p-3"}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Wind className="h-3.5 w-3.5" />Viento</div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{Math.round(current.wind_speed_10m)} <span className="text-xs font-normal">km/h</span></p>
            </div>
            <div className={planner ? "rounded-xl bg-background/55 p-2" : "rounded-xl bg-background/55 p-3"}>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><Droplets className="h-3.5 w-3.5" />Humedad</div>
              <p className="mt-1 text-xl font-semibold tabular-nums">{Math.round(current.relative_humidity_2m)}%</p>
            </div>
          </div>
        )) : null}
      {!compact && <p className={planner ? "mt-3 border-t border-border/70 pt-2 text-[10px] text-muted-foreground" : "mt-4 border-t border-border/70 pt-3 text-[11px] text-muted-foreground"}>Condiciones actuales estimadas por Open-Meteo. La ubicación se detecta automáticamente; si no autorizas el acceso, se usa Buenaventura.</p>}
      </div>
    </section>
  );
}
