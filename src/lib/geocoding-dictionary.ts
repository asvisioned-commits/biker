export interface LocalPlace {
  name: string;
  lat: number;
  lng: number;
  description?: string;
}

export const REGIONAL_PLACES: Record<'ZW' | 'ZM', LocalPlace[]> = {
  ZW: [
    { name: "Sam Levy's Village, Borrowdale", lat: -17.7502, lng: 31.0858, description: "Shopping Mall, Borrowdale Rd" },
    { name: "Avondale Shops, King George Rd", lat: -17.7994, lng: 31.0378, description: "Shopping Center, Avondale" },
    { name: "Eastgate Mall, Harare CBD", lat: -17.8312, lng: 31.0521, description: "Shopping & Office Complex, CBD" },
    { name: "Joina City, Harare CBD", lat: -17.8306, lng: 31.0494, description: "High-Rise Mall & Office Tower" },
    { name: "Arundel Office Park, Mount Pleasant", lat: -17.7812, lng: 31.0531, description: "Corporate Park, Mt Pleasant" },
    { name: "Borrowdale Brooke Golf Estate", lat: -17.7289, lng: 31.1345, description: "Residential Estate & Golf Club" },
    { name: "Westgate Shopping Mall, Harare", lat: -17.7667, lng: 30.9856, description: "Shopping Mall, Westgate" },
    { name: "Belgravia Shops, Harare", lat: -17.7932, lng: 31.0468, description: "Belgravia Shopping Area" },
    { name: "Kensington Shops, Avondale", lat: -17.8015, lng: 31.0298, description: "Shopping Area, Kensington" },
    { name: "Kamfinsa Shopping Centre, Greendale", lat: -17.8183, lng: 31.1147, description: "Shopping Centre, Kamfinsa" }
  ],
  ZM: [
    { name: "Manda Hill Shopping Mall, Lusaka", lat: -15.3912, lng: 28.3075, description: "Shopping Mall, Great East Rd" },
    { name: "Levy Junction Mall, Lusaka", lat: -15.4206, lng: 28.2889, description: "Shopping & Office Mall, CBD" },
    { name: "East Park Mall, Lusaka", lat: -15.3958, lng: 28.3186, description: "Shopping Mall, Great East Rd" },
    { name: "Woodlands Shopping Mall, Lusaka", lat: -15.4431, lng: 28.3364, description: "Woodlands Shopping Center" },
    { name: "Kabulonga Shopping Centre, Lusaka", lat: -15.4194, lng: 28.3494, description: "Kabulonga Shopping Center" },
    { name: "Lusaka CBD Post Office", lat: -15.4167, lng: 28.2833, description: "Central Post Office, Lusaka" },
    { name: "Arcades Shopping Mall, Lusaka", lat: -15.3992, lng: 28.3136, description: "Arcades Shopping Center" },
    { name: "Crossroads Shopping Mall, Lusaka", lat: -15.4475, lng: 28.3608, description: "Crossroads Shopping Center" }
  ]
};

export function searchLocalPlaces(query: string, country: 'ZW' | 'ZM'): LocalPlace[] {
  if (!query || query.trim().length < 2) return [];
  const normalizedQuery = query.toLowerCase().trim();
  const places = REGIONAL_PLACES[country] || [];
  
  return places.filter(place => 
    place.name.toLowerCase().includes(normalizedQuery) || 
    (place.description && place.description.toLowerCase().includes(normalizedQuery))
  );
}
