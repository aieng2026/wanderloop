export type Destination = {
  slug: string;
  city: string;
  country: string;
  prompt: string;
  photo: {
    url: string;
    blurDataUrl?: string;
    alt: string;
  };
};

const UNSPLASH = (id: string, w = 800) =>
  `https://images.unsplash.com/photo-${id}?w=${w}&auto=format&fit=crop&q=80`;

export const DESTINATIONS: Destination[] = [
  {
    slug: "lisbon",
    city: "Lisbon",
    country: "Portugal",
    prompt: "5 days in Lisbon, foodie, mid-budget",
    photo: {
      url: UNSPLASH("1555881400-74d7acaacd8b"),
      alt: "Sunset over Lisbon's terracotta rooftops and tram tracks",
    },
  },
  {
    slug: "tokyo",
    city: "Tokyo",
    country: "Japan",
    prompt: "Long weekend in Tokyo, art and ramen",
    photo: {
      url: UNSPLASH("1540959733332-eab4deabeeaf"),
      alt: "Tokyo skyline at dusk",
    },
  },
  {
    slug: "paris",
    city: "Paris",
    country: "France",
    prompt: "4 days in Paris, relaxed pace, museums",
    photo: {
      url: UNSPLASH("1502602898657-3e91760cbb34"),
      alt: "Eiffel Tower at golden hour",
    },
  },
  {
    slug: "new-york",
    city: "New York",
    country: "USA",
    prompt: "3 days in New York with a 5 year old kid",
    photo: {
      url: UNSPLASH("1496442226666-8d4d0e62e6e9"),
      alt: "Manhattan skyline from the East River",
    },
  },
  {
    slug: "reykjavik",
    city: "Reykjavik",
    country: "Iceland",
    prompt: "7 days in Iceland, road trip, northern lights",
    photo: {
      url: UNSPLASH("1518002171953-a080ee817e1f"),
      alt: "Icelandic mountains in mist",
    },
  },
  {
    slug: "marrakech",
    city: "Marrakech",
    country: "Morocco",
    prompt: "5 days in Marrakech, design and souks",
    photo: {
      url: UNSPLASH("1546412414-e1885259563a"),
      alt: "Marrakech medina archway and lanterns",
    },
  },
  {
    slug: "cape-town",
    city: "Cape Town",
    country: "South Africa",
    prompt: "6 days in Cape Town, hikes and wineries",
    photo: {
      url: UNSPLASH("1452587925148-ce544e77e70d"),
      alt: "Cape Town coastal landscape",
    },
  },
  {
    slug: "buenos-aires",
    city: "Buenos Aires",
    country: "Argentina",
    prompt: "5 days in Buenos Aires, tango and steakhouse hops",
    photo: {
      url: UNSPLASH("1539037116277-4db20889f2d4"),
      alt: "Buenos Aires Plaza de Mayo at sunset",
    },
  },
];
