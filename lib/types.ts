// Shared types for tool outputs. All synthetic for demo purposes.

export type Flight = {
  airline: string;
  flightNumber: string;
  origin: string;
  destination: string;
  departTime: string;
  arriveTime: string;
  durationHours: number;
  priceUSD: number;
  stops: number;
};

export type Restaurant = {
  name: string;
  cuisine: string;
  neighborhood: string;
  priceLevel: 1 | 2 | 3 | 4;
  rating: number;
  signature: string;
};

export type Attraction = {
  name: string;
  category: "museum" | "viewpoint" | "neighborhood" | "park" | "experience";
  neighborhood: string;
  estimatedHours: number;
  notes: string;
};

export type WeatherDay = {
  date: string;
  highC: number;
  lowC: number;
  condition: "sunny" | "partly cloudy" | "cloudy" | "rain" | "storm";
  precipitationPct: number;
};
