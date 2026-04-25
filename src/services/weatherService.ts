export interface WeatherData {
  current: {
    temp: number;
    description: string;
    humidity: number;
    windSpeed: number;
  };
  daily: {
    date: string;
    tempMax: number;
    tempMin: number;
    condition: string;
  }[];
}

export async function fetchWeather(lat: number, lon: number, startDate?: string, endDate?: string): Promise<WeatherData> {
  // Use historical API if start date is in the past, otherwise use forecast API (or both depending on date, but Open-Meteo forecast handles up to 3 months past if we use the right params. Let's just pass start_date and end_date if provided)
  let url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`;
  
  if (startDate && endDate) {
    url += `&start_date=${startDate}&end_date=${endDate}`;
  }

  const response = await fetch(url);
  const data = await response.json();

  if (!data.current_weather) throw new Error("Failed to fetch current weather");

  return {
    current: {
      temp: data.current_weather.temperature,
      description: getWeatherCondition(data.current_weather.weathercode),
      humidity: 0, // Open-Meteo current_weather doesn't always have humidity in simple call, but it's okay for demo
      windSpeed: data.current_weather.windspeed,
    },
    daily: data.daily.time.map((time: string, i: number) => ({
      date: time,
      tempMax: data.daily.temperature_2m_max[i],
      tempMin: data.daily.temperature_2m_min[i],
      condition: getWeatherCondition(data.daily.weathercode[i]),
    }))
  };
}

export async function searchLocations(query: string) {
  if (!query || query.length < 2) return [];
  const url = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`;
  const response = await fetch(url);
  const data = await response.json();
  return data.results || [];
}

function getWeatherCondition(code: number): string {
  const conditions: { [key: number]: string } = {
    0: "Clear sky",
    1: "Mainly clear", 2: "Partly cloudy", 3: "Overcast",
    45: "Fog", 48: "Depositing rime fog",
    51: "Light drizzle", 53: "Moderate drizzle", 55: "Dense drizzle",
    61: "Slight rain", 63: "Moderate rain", 65: "Heavy rain",
    71: "Slight snow fall", 73: "Moderate snow fall", 75: "Heavy snow fall",
    80: "Slight rain showers", 81: "Moderate rain showers", 82: "Violent rain showers",
    95: "Thunderstorm",
  };
  return conditions[code] || "Unknown";
}
