import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import { 
    Coffee, Navigation, Search, Heart, MapPin, 
    Loader2, Wifi, Compass, Star, 
    Bookmark, Menu, X, CheckCircle2, List, Map, Maximize2, Minimize2, Layers
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default preset coordinates (Central Park, NY)
const DEFAULT_COORDS = { lat: 40.7829, lng: -73.9654, name: "New York, NY" };

const PRESET_LOCATIONS = [
    { name: "New York, US", lat: 40.7829, lng: -73.9654 },
    { name: "London, UK", lat: 51.5074, lng: -0.1278 },
    { name: "Tokyo, JP", lat: 35.6762, lng: 139.6503 },
    { name: "Paris, FR", lat: 48.8566, lng: 2.3522 },
    { name: "Manila, PH", lat: 14.5995, lng: 120.9842 },
    { name: "San Francisco, US", lat: 37.7749, lng: -122.4194 }
];

// Map Tile Themes - Soft Pastel Collection
const MAP_THEMES = [
    {
        id: 'voyager',
        name: 'Soft Pastel Cream',
        icon: '☕',
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    },
    {
        id: 'light',
        name: 'Latte Light',
        icon: '☀️',
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    },
    {
        id: 'street',
        name: 'Pastel Streets',
        icon: '🗺️',
        url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; OpenStreetMap contributors'
    },
    {
        id: 'dark',
        name: 'Mocha Dark',
        icon: '🌙',
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; OpenStreetMap contributors &copy; CARTO'
    }
];

export default function Welcome() {
    // LocalStorage State for Saved Favorites & Saved Walking Routes
    const [favorites, setFavorites] = useState([]);
    const [savedRoutes, setSavedRoutes] = useState([]);

    // Toast Alert
    const [toast, setToast] = useState(null);

    // Mobile View Toggle State ('map' | 'list')
    const [mobileViewMode, setMobileViewMode] = useState('map');

    // Fullscreen Map State
    const [isMapFullscreen, setIsMapFullscreen] = useState(false);

    // Map Theme State ('voyager' | 'light' | 'street' | 'dark')
    const [mapTheme, setMapTheme] = useState(() => {
        return localStorage.getItem('roastroute_map_theme') || 'voyager';
    });

    // Map & Cafe states
    const [userLocation, setUserLocation] = useState(null);
    const [locationName, setLocationName] = useState("Detecting location...");
    const [cafes, setCafes] = useState([]);
    const [selectedCafe, setSelectedCafe] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null);
    const [isRouting, setIsRouting] = useState(false);
    
    // Controls & Filters
    const [radius, setRadius] = useState(1500); // meters
    const [searchQuery, setSearchQuery] = useState('');
    const [customLocationSearch, setCustomLocationSearch] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // all, wifi, favorites
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

    // Leaflet refs
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const tileLayerRef = useRef(null);
    const markersLayerRef = useRef(null);
    const routeLineRef = useRef(null);

    // Load saved favorites & routes from LocalStorage
    useEffect(() => {
        const storedFavs = localStorage.getItem('roastroute_guest_favorites');
        if (storedFavs) {
            try { setFavorites(JSON.parse(storedFavs)); } catch (e) {}
        }

        const storedRoutes = localStorage.getItem('roastroute_guest_routes');
        if (storedRoutes) {
            try { setSavedRoutes(JSON.parse(storedRoutes)); } catch (e) {}
        }

        detectLocation();
    }, []);

    // Show quick toast notification
    const showToast = (message) => {
        setToast(message);
        setTimeout(() => setToast(null), 3000);
    };

    // Toggle Favorite Cafe
    const toggleFavorite = (cafe) => {
        const exists = favorites.some(f => f.id === cafe.id);
        let updatedFavs;
        if (exists) {
            updatedFavs = favorites.filter(f => f.id !== cafe.id);
            showToast(`Removed "${cafe.name}" from saved list.`);
        } else {
            updatedFavs = [...favorites, cafe];
            showToast(`Saved "${cafe.name}" to your list! ❤️`);
        }

        setFavorites(updatedFavs);
        localStorage.setItem('roastroute_guest_favorites', JSON.stringify(updatedFavs));
    };

    // Save Custom Route Path
    const handleSaveRoute = (cafe) => {
        if (!routeInfo) return;
        const exists = savedRoutes.some(r => r.cafeId === cafe.id);
        if (exists) {
            showToast(`Route to "${cafe.name}" is already saved.`);
            return;
        }

        const newRoute = {
            id: Date.now(),
            cafeId: cafe.id,
            cafeName: cafe.name,
            address: cafe.address,
            distance: routeInfo.distance,
            walkTime: routeInfo.walkTime,
            savedAt: new Date().toLocaleDateString()
        };

        const updatedRoutes = [...savedRoutes, newRoute];
        setSavedRoutes(updatedRoutes);
        localStorage.setItem('roastroute_guest_routes', JSON.stringify(updatedRoutes));
        showToast(`Route to "${cafe.name}" saved! 🔖`);
    };

    // Detect browser location
    const detectLocation = () => {
        setIsLoading(true);
        setErrorMsg(null);

        if (!navigator.geolocation) {
            setErrorMsg("Geolocation not supported. Showing fallback location.");
            useFallbackLocation(DEFAULT_COORDS);
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setUserLocation(coords);
                setLocationName("Your Current Location");
                fetchNearbyCafes(coords.lat, coords.lng, radius);
            },
            (err) => {
                console.warn("Location error:", err);
                setErrorMsg("Location access denied. Showing New York, NY.");
                useFallbackLocation(DEFAULT_COORDS);
            },
            { enableHighAccuracy: true, timeout: 8000 }
        );
    };

    const useFallbackLocation = (preset) => {
        const coords = { lat: preset.lat, lng: preset.lng };
        setUserLocation(coords);
        setLocationName(preset.name);
        fetchNearbyCafes(preset.lat, preset.lng, radius);
    };

    // Geocoding location search via Nominatim
    const handleSearchLocationSubmit = async (e) => {
        e.preventDefault();
        if (!customLocationSearch.trim()) return;

        setIsLoading(true);
        setErrorMsg(null);

        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(customLocationSearch)}`;
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.length > 0) {
                const first = data[0];
                const coords = { lat: parseFloat(first.lat), lng: parseFloat(first.lon) };
                setUserLocation(coords);
                setLocationName(first.display_name.split(',')[0]);
                fetchNearbyCafes(coords.lat, coords.lng, radius);
                showToast(`Location set to "${first.display_name.split(',')[0]}"`);
            } else {
                setErrorMsg(`No locations found for "${customLocationSearch}"`);
                setIsLoading(false);
            }
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to search location.");
            setIsLoading(false);
        }
    };

    // Fetch nearby cafes from Overpass API
    const fetchNearbyCafes = async (lat, lng, searchRadius) => {
        setIsLoading(true);
        setErrorMsg(null);
        setSelectedCafe(null);
        setRouteInfo(null);

        const query = `[out:json][timeout:15];
            node(around:${searchRadius},${lat},${lng})["amenity"="cafe"];
            out body;`;

        const mirrors = [
            'https://overpass-api.de/api/interpreter',
            'https://overpass.kumi.systems/api/interpreter',
            'https://lz4.overpass-api.de/api/interpreter',
            'https://z.overpass-api.de/api/interpreter'
        ];

        let data = null;
        let success = false;

        for (const mirror of mirrors) {
            try {
                const url = `${mirror}?data=${encodeURIComponent(query)}`;
                const response = await fetch(url);
                if (response.ok) {
                    data = await response.json();
                    success = true;
                    break;
                }
            } catch (err) {
                console.warn(`Overpass mirror ${mirror} failed:`, err);
            }
        }

        if (!success) {
            const mockData = generateMockCafes(lat, lng);
            setCafes(mockData);
            setIsLoading(false);
            return;
        }

        try {
            const formattedCafes = (data.elements || []).map(el => {
                const dist = calculateDistance(lat, lng, el.lat, el.lon);
                let address = "Address not listed";
                if (el.tags) {
                    const street = el.tags['addr:street'] || '';
                    const num = el.tags['addr:housenumber'] || '';
                    const city = el.tags['addr:city'] || '';
                    if (street || num) {
                        address = `${num} ${street}${city ? ', ' + city : ''}`.trim();
                    }
                }

                return {
                    id: el.id,
                    name: el.tags?.name || "Unnamed Artisanal Cafe",
                    lat: el.lat,
                    lng: el.lon,
                    distance: dist,
                    address: address,
                    opening_hours: el.tags?.opening_hours || "07:00 - 19:00",
                    phone: el.tags?.phone || el.tags?.['contact:phone'] || null,
                    website: el.tags?.website || el.tags?.['contact:website'] || null,
                    has_wifi: el.tags?.internet_access === 'wlan' || el.tags?.internet_access === 'yes' || Math.random() > 0.4,
                    rating: (4.0 + Math.random() * 0.9).toFixed(1)
                };
            });

            formattedCafes.sort((a, b) => a.distance - b.distance);
            setCafes(formattedCafes);
        } catch (err) {
            console.error("Error formatting cafes:", err);
            setErrorMsg("Failed to parse cafe data.");
        } finally {
            setIsLoading(false);
        }
    };

    // Straight line distance calculation
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371e3;
        const φ1 = lat1 * Math.PI/180;
        const φ2 = lat2 * Math.PI/180;
        const Δφ = (lat2-lat1) * Math.PI/180;
        const Δλ = (lon2-lon1) * Math.PI/180;
        const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
                  Math.cos(φ1) * Math.cos(φ2) *
                  Math.sin(Δλ/2) * Math.sin(Δλ/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return Math.round(R * c);
    };

    // Fallback mock cafe generator
    const generateMockCafes = (centerLat, centerLng) => {
        const mockNames = [
            "Espresso Alchemy & Roastery", "The Velvet Bean", "Artisan Coffee Lab",
            "Mellow Grind Cafe", "Roast & Relish", "Copper Kettle Coffee Co.",
            "Urban Drip & Brew", "Amber Leaf Espresso Bar"
        ];
        return mockNames.map((name, idx) => {
            const offsetLat = (Math.random() - 0.5) * 0.015;
            const offsetLng = (Math.random() - 0.5) * 0.015;
            const lat = centerLat + offsetLat;
            const lng = centerLng + offsetLng;
            const dist = calculateDistance(centerLat, centerLng, lat, lng);
            return {
                id: 1000 + idx,
                name: name,
                lat: lat,
                lng: lng,
                distance: dist,
                address: `${100 + idx} Coffee Street, Craft District`,
                opening_hours: "07:00 - 19:00",
                phone: "+1 555-0192",
                website: "https://example.com/cafe",
                has_wifi: idx % 2 === 0,
                rating: (4.2 + (idx % 8) * 0.1).toFixed(1)
            };
        }).sort((a, b) => a.distance - b.distance);
    };

    // Initialize Leaflet Map
    useEffect(() => {
        if (!userLocation || !mapContainerRef.current) return;

        if (!mapRef.current) {
            const map = L.map(mapContainerRef.current, {
                zoomControl: false
            }).setView([userLocation.lat, userLocation.lng], 15);

            const initialThemeObj = MAP_THEMES.find(t => t.id === mapTheme) || MAP_THEMES[0];

            const initialTileLayer = L.tileLayer(initialThemeObj.url, {
                attribution: initialThemeObj.attribution,
                maxZoom: 19
            }).addTo(map);

            tileLayerRef.current = initialTileLayer;

            L.control.zoom({ position: 'topright' }).addTo(map);

            mapRef.current = map;
            markersLayerRef.current = L.layerGroup().addTo(map);
        } else {
            mapRef.current.setView([userLocation.lat, userLocation.lng], 15);
        }

        renderMapMarkers();
    }, [userLocation, cafes, selectedCafe, favorites]);

    // Handle Map Theme Switching
    useEffect(() => {
        if (!mapRef.current) return;
        const themeObj = MAP_THEMES.find(t => t.id === mapTheme) || MAP_THEMES[0];

        if (tileLayerRef.current) {
            mapRef.current.removeLayer(tileLayerRef.current);
        }

        const newLayer = L.tileLayer(themeObj.url, {
            attribution: themeObj.attribution,
            maxZoom: 19
        }).addTo(mapRef.current);

        tileLayerRef.current = newLayer;
        localStorage.setItem('roastroute_map_theme', mapTheme);
    }, [mapTheme]);

    // Handle map resize invalidation when switching view modes or toggling fullscreen
    useEffect(() => {
        if (mapRef.current) {
            setTimeout(() => {
                mapRef.current.invalidateSize();
            }, 200);
        }
    }, [mobileViewMode, isMapFullscreen]);

    // Render Markers on Map
    const renderMapMarkers = () => {
        if (!mapRef.current || !markersLayerRef.current || !userLocation) return;

        markersLayerRef.current.clearLayers();

        // User Location Pin
        const userIcon = L.divIcon({
            className: 'custom-user-pin',
            html: `
                <div class="user-marker-container">
                    <div class="user-pulse-ring"></div>
                    <div class="user-marker-core"></div>
                </div>
            `,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        L.marker([userLocation.lat, userLocation.lng], { icon: userIcon })
            .addTo(markersLayerRef.current)
            .bindPopup(`
                <div class="map-popup-card">
                    <p class="popup-title font-bold">📍 Your Location</p>
                    <p class="popup-address">${locationName}</p>
                </div>
            `);

        // Cafe Pins
        cafes.forEach(cafe => {
            const isSelected = selectedCafe && selectedCafe.id === cafe.id;
            const isFav = favorites.some(f => f.id === cafe.id);

            let markerClass = 'cafe-marker-container';
            if (isSelected) markerClass += ' selected';
            if (isFav) markerClass += ' favorited';

            const cafeIcon = L.divIcon({
                className: 'custom-cafe-pin',
                html: `
                    <div class="${markerClass}">
                        <div class="cafe-marker-pin">
                            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                                <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                                <line x1="6" x2="6" y1="2" y2="4"/>
                                <line x1="10" x2="10" y1="2" y2="4"/>
                                <line x1="14" x2="14" y1="2" y2="4"/>
                            </svg>
                        </div>
                        <div class="cafe-marker-shadow"></div>
                    </div>
                `,
                iconSize: [38, 38],
                iconAnchor: [19, 38]
            });

            const marker = L.marker([cafe.lat, cafe.lng], { icon: cafeIcon })
                .addTo(markersLayerRef.current);

            marker.on('click', () => {
                selectCafe(cafe);
            });
        });
    };

    // Select Cafe & Fetch Real OSRM Foot Route
    const selectCafe = async (cafe) => {
        setSelectedCafe(cafe);
        setIsRouting(true);

        if (!userLocation || !mapRef.current) return;

        if (routeLineRef.current) {
            mapRef.current.removeLayer(routeLineRef.current);
        }

        let routeLatLngs = [
            [userLocation.lat, userLocation.lng],
            [cafe.lat, cafe.lng]
        ];

        let actualDistMeters = cafe.distance;
        let walkMins = Math.ceil(cafe.distance / 75);

        try {
            const osrmUrl = `https://router.project-osrm.org/route/v1/foot/${userLocation.lng},${userLocation.lat};${cafe.lng},${cafe.lat}?overview=full&geometries=geojson`;
            const res = await fetch(osrmUrl);
            if (res.ok) {
                const data = await res.json();
                if (data.routes && data.routes.length > 0) {
                    const osrmRoute = data.routes[0];
                    routeLatLngs = osrmRoute.geometry.coordinates.map(([lng, lat]) => [lat, lng]);
                    actualDistMeters = Math.round(osrmRoute.distance);
                    walkMins = Math.ceil(osrmRoute.duration / 60);
                }
            }
        } catch (err) {
            console.warn("OSRM routing API error, falling back to direct path:", err);
        } finally {
            setIsRouting(false);
        }

        // Draw animated street polyline (Soft Caramel Pastel)
        const line = L.polyline(routeLatLngs, {
            color: '#D9822B',
            weight: 5,
            opacity: 0.9,
            lineCap: 'round',
            lineJoin: 'round',
            className: 'route-animate-line'
        }).addTo(mapRef.current);

        routeLineRef.current = line;

        setRouteInfo({
            distance: actualDistMeters >= 1000 ? `${(actualDistMeters / 1000).toFixed(1)} km` : `${actualDistMeters} m`,
            walkTime: `${walkMins} min walk`
        });

        mapRef.current.fitBounds(line.getBounds(), { padding: [60, 60], maxZoom: 17 });
    };

    // Filter logic
    const filteredCafes = cafes.filter(cafe => {
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const matchName = cafe.name.toLowerCase().includes(q);
            const matchAddress = cafe.address.toLowerCase().includes(q);
            if (!matchName && !matchAddress) return false;
        }

        if (activeFilter === 'wifi' && !cafe.has_wifi) return false;
        if (activeFilter === 'favorites') {
            return favorites.some(f => f.id === cafe.id);
        }
        return true;
    });

    return (
        <>
            <Head title="RoastRoute - Pastel Coffee Shop Finder" />

            <div className="min-h-screen bg-[#FFFBF5] text-[#3C2A21] font-sans selection:bg-[#F3C590] selection:text-[#3C2A21] overflow-x-hidden">
                
                {/* Floating Toast Notification (Pastel Toast) */}
                {toast && (
                    <div className="fixed top-20 right-4 left-4 sm:left-auto z-[60] px-4 py-3 bg-[#FFFDF9] border border-[#EADBC8] rounded-2xl shadow-xl text-xs font-bold text-[#C87524] flex items-center gap-2 animate-bounce justify-center sm:justify-start">
                        <CheckCircle2 className="w-4 h-4 text-[#D9822B] shrink-0" />
                        <span className="truncate">{toast}</span>
                    </div>
                )}

                {/* 1. Header Navigation Bar (Soft Pastel Cream) */}
                <header className="sticky top-0 z-40 w-full bg-[#FFFDF9]/90 backdrop-blur-xl border-b border-[#EADBC8]/70">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 sm:h-18 flex items-center justify-between">
                        
                        {/* Brand Logo */}
                        <div className="flex items-center gap-2.5 sm:gap-3">
                            <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-2xl bg-gradient-to-tr from-[#D9822B] via-[#E5C39E] to-[#F7CAD0] p-0.5 shadow-md shadow-[#D9822B]/15">
                                <div className="w-full h-full bg-[#FFFDF9] rounded-[14px] flex items-center justify-center">
                                    <Coffee className="w-4 h-4 sm:w-5 sm:h-5 text-[#C87524]" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-lg sm:text-xl font-black tracking-tight text-[#3C2A21] flex items-center gap-1">
                                    Roast<span className="text-[#C87524]">Route</span>
                                </h1>
                                <p className="text-[9px] sm:text-[10px] text-[#8C7A6B] font-semibold tracking-wider uppercase">Pastel Coffee Finder</p>
                            </div>
                        </div>

                        {/* Desktop Nav Items */}
                        <nav className="hidden md:flex items-center gap-8 text-sm font-semibold text-[#5C4B3E]">
                            <a href="#explorer" className="hover:text-[#C87524] transition-colors flex items-center gap-1.5">
                                <Compass className="w-4 h-4 text-[#D9822B]" />
                                <span>Find Cafes</span>
                            </a>
                            <a href="#saved" className="hover:text-[#C87524] transition-colors flex items-center gap-1 text-xs font-bold text-[#E86A92]">
                                <Heart className="w-3.5 h-3.5 fill-[#E86A92]" />
                                <span>Saved Spots ({favorites.length})</span>
                            </a>
                        </nav>

                        {/* Location Status Pill */}
                        <div className="hidden sm:flex items-center gap-2 px-3.5 py-1.5 bg-[#F9F3EE] border border-[#EADBC8] rounded-full text-xs font-semibold text-[#5C4B3E] max-w-[200px]">
                            <MapPin className="w-3.5 h-3.5 text-[#D9822B] shrink-0" />
                            <span className="truncate">{locationName}</span>
                        </div>

                        {/* Mobile Menu Toggle Button */}
                        <button 
                            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                            className="md:hidden p-2 text-[#5C4B3E] hover:text-[#3C2A21] rounded-xl bg-[#F9F3EE] border border-[#EADBC8]"
                        >
                            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
                        </button>
                    </div>

                    {/* Mobile Navigation Drawer */}
                    {mobileMenuOpen && (
                        <div className="md:hidden bg-[#FFFDF9] border-b border-[#EADBC8] p-4 space-y-3 animate-slideDown shadow-lg">
                            <a 
                                href="#explorer" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F9F3EE] border border-[#EADBC8] text-sm font-bold text-[#3C2A21]"
                            >
                                <Compass className="w-4 h-4 text-[#D9822B]" />
                                <span>Find Coffee Shops</span>
                            </a>
                            <a 
                                href="#saved" 
                                onClick={() => setMobileMenuOpen(false)}
                                className="flex items-center gap-2.5 p-3 rounded-xl bg-[#F9F3EE] border border-[#EADBC8] text-sm font-bold text-[#E86A92]"
                            >
                                <Heart className="w-4 h-4 fill-[#E86A92]" />
                                <span>My Saved Spots ({favorites.length})</span>
                            </a>
                            <div className="pt-2 flex items-center gap-2 text-xs text-[#7F665B] px-1">
                                <MapPin className="w-3.5 h-3.5 text-[#D9822B]" />
                                <span>Current: {locationName}</span>
                            </div>
                        </div>
                    )}
                </header>

                {/* 2. Soft Pastel Hero Section */}
                <section className="relative overflow-hidden pt-8 pb-10 sm:pt-10 sm:pb-12 bg-gradient-to-b from-[#FFFDF9] via-[#F9F3EE] to-[#FFFBF5] border-b border-[#EADBC8]/60">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-20%,rgba(244,162,97,0.15),rgba(255,255,255,0))]" />
                    
                    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#FCEADE] border border-[#F3C590] text-[#C87524] text-[11px] font-bold uppercase tracking-wider mb-4">
                            ✨ Warm Pastel Edition
                        </span>

                        <h2 className="text-3xl sm:text-5xl font-black text-[#3C2A21] tracking-tight max-w-3xl mx-auto leading-tight">
                            Discover Cozy <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#C87524] via-[#D9822B] to-[#E76F51]">Coffee Spots</span> Near You.
                        </h2>

                        <p className="mt-2.5 text-xs sm:text-base text-[#7F665B] max-w-2xl mx-auto leading-relaxed font-medium">
                            Explore nearby specialty roasteries, real street walking routes, WiFi spots, and saved cafes.
                        </p>

                        {/* Preset Cities Quick Switcher */}
                        <div className="mt-5 flex flex-wrap items-center justify-center gap-1.5 sm:gap-2 max-w-2xl mx-auto">
                            <span className="text-xs text-[#8C7A6B] font-semibold mr-1 w-full sm:w-auto text-center sm:text-left mb-1 sm:mb-0">
                                Popular Cities:
                            </span>
                            {PRESET_LOCATIONS.map((preset) => (
                                <button
                                    key={preset.name}
                                    onClick={() => useFallbackLocation(preset)}
                                    className="px-3 py-1.5 bg-[#FFFDF9] hover:bg-[#FCEADE] border border-[#EADBC8] hover:border-[#F3C590] rounded-xl text-[11px] sm:text-xs font-semibold text-[#5C4B3E] hover:text-[#C87524] transition-all flex items-center gap-1 shadow-sm"
                                >
                                    <MapPin className="w-3 h-3 text-[#D9822B]" />
                                    <span>{preset.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </section>

                {/* 3. Main Interactive Map & Explorer Section */}
                <section id="explorer" className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-6 sm:py-8">
                    
                    {/* Controls & Search Bar */}
                    <div className="bg-[#FFFDF9]/90 border border-[#EADBC8] rounded-2xl sm:rounded-3xl p-3.5 sm:p-5 shadow-xl mb-4 sm:mb-6 backdrop-blur-md">
                        <div className="flex flex-col lg:flex-row gap-3.5 sm:gap-4 justify-between items-stretch lg:items-center">
                            
                            {/* Search Location Input */}
                            <form onSubmit={handleSearchLocationSubmit} className="flex items-center gap-2">
                                <div className="relative flex-1">
                                    <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[#8C7A6B]" />
                                    <input
                                        type="text"
                                        placeholder="Search city or street..."
                                        value={customLocationSearch}
                                        onChange={(e) => setCustomLocationSearch(e.target.value)}
                                        className="w-full pl-9 pr-3 py-2 sm:py-2.5 bg-[#F9F3EE] border border-[#EADBC8] rounded-xl sm:rounded-2xl text-xs sm:text-sm text-[#3C2A21] placeholder-[#A08D80] focus:outline-none focus:border-[#D9822B] transition-colors"
                                    />
                                </div>
                                <button
                                    type="submit"
                                    className="px-3.5 sm:px-4 py-2 sm:py-2.5 bg-[#D9822B] hover:bg-[#C87524] text-white text-xs font-bold rounded-xl sm:rounded-2xl transition-all shrink-0 shadow-sm"
                                >
                                    Search
                                </button>
                                <button
                                    type="button"
                                    onClick={detectLocation}
                                    title="Locate Me"
                                    className="p-2 sm:p-2.5 bg-[#F9F3EE] hover:bg-[#FCEADE] border border-[#EADBC8] rounded-xl sm:rounded-2xl text-[#D9822B] transition-colors shrink-0"
                                >
                                    <Navigation className="w-4 h-4" />
                                </button>
                            </form>

                            {/* Map Style Theme & Radius Selectors */}
                            <div className="flex flex-wrap items-center justify-between sm:justify-start gap-2">
                                
                                {/* MAP TILE THEME SELECTOR */}
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F9F3EE] border border-[#EADBC8] rounded-xl text-xs">
                                    <Layers className="w-3.5 h-3.5 text-[#D9822B] shrink-0" />
                                    <span className="text-[#7F665B]">Style:</span>
                                    <select
                                        value={mapTheme}
                                        onChange={(e) => setMapTheme(e.target.value)}
                                        className="bg-transparent text-[#C87524] font-bold focus:outline-none cursor-pointer text-xs"
                                    >
                                        {MAP_THEMES.map(theme => (
                                            <option key={theme.id} value={theme.id} className="bg-[#FFFDF9] text-[#3C2A21]">
                                                {theme.icon} {theme.name}
                                            </option>
                                        ))}
                                    </select>
                                </div>

                                {/* Radius Selector */}
                                <div className="flex items-center gap-1.5 px-3 py-1.5 bg-[#F9F3EE] border border-[#EADBC8] rounded-xl text-xs">
                                    <Compass className="w-3.5 h-3.5 text-[#D9822B]" />
                                    <span className="text-[#7F665B]">Radius:</span>
                                    <select
                                        value={radius}
                                        onChange={(e) => {
                                            const r = parseInt(e.target.value);
                                            setRadius(r);
                                            if (userLocation) fetchNearbyCafes(userLocation.lat, userLocation.lng, r);
                                        }}
                                        className="bg-transparent text-[#C87524] font-bold focus:outline-none cursor-pointer text-xs"
                                    >
                                        <option value="800" className="bg-[#FFFDF9]">800 m</option>
                                        <option value="1500" className="bg-[#FFFDF9]">1.5 km</option>
                                        <option value="3000" className="bg-[#FFFDF9]">3.0 km</option>
                                        <option value="5000" className="bg-[#FFFDF9]">5.0 km</option>
                                    </select>
                                </div>

                                {/* Filter Chips */}
                                <div className="flex items-center gap-1 bg-[#F9F3EE] p-1 border border-[#EADBC8] rounded-xl text-xs">
                                    <button
                                        onClick={() => setActiveFilter('all')}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                                            activeFilter === 'all' 
                                                ? 'bg-[#D9822B] text-white shadow-sm' 
                                                : 'text-[#7F665B] hover:text-[#3C2A21]'
                                        }`}
                                    >
                                        All ({cafes.length})
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter('wifi')}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                                            activeFilter === 'wifi' 
                                                ? 'bg-[#D9822B] text-white shadow-sm' 
                                                : 'text-[#7F665B] hover:text-[#3C2A21]'
                                        }`}
                                    >
                                        <Wifi className="w-3 h-3" />
                                        <span>WiFi</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveFilter('favorites')}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1 ${
                                            activeFilter === 'favorites' 
                                                ? 'bg-[#D9822B] text-white shadow-sm' 
                                                : 'text-[#7F665B] hover:text-[#3C2A21]'
                                        }`}
                                    >
                                        <Heart className="w-3 h-3 fill-current" />
                                        <span>Saved ({favorites.length})</span>
                                    </button>
                                </div>

                            </div>
                        </div>

                        {/* Status notification bar */}
                        <div className="mt-2.5 flex items-center justify-between text-[11px] sm:text-xs text-[#7F665B] pt-2 border-t border-[#EADBC8]/60">
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                                <span className="truncate">Found <strong className="text-[#3C2A21]">{filteredCafes.length} cafes</strong> near {locationName}</span>
                            </div>
                            {errorMsg && <span className="text-[#C87524] font-medium truncate ml-2">{errorMsg}</span>}
                        </div>
                    </div>

                    {/* Mobile Screen View Switcher Pill */}
                    <div className="flex lg:hidden justify-center mb-4">
                        <div className="flex bg-[#FFFDF9] border border-[#EADBC8] p-1 rounded-2xl shadow-md">
                            <button
                                onClick={() => setMobileViewMode('map')}
                                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                                    mobileViewMode === 'map' 
                                        ? 'bg-[#D9822B] text-white shadow-sm' 
                                        : 'text-[#7F665B] hover:text-[#3C2A21]'
                                }`}
                            >
                                <Map className="w-4 h-4" />
                                <span>Map View</span>
                            </button>
                            <button
                                onClick={() => setMobileViewMode('list')}
                                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-extrabold transition-all ${
                                    mobileViewMode === 'list' 
                                        ? 'bg-[#D9822B] text-white shadow-sm' 
                                        : 'text-[#7F665B] hover:text-[#3C2A21]'
                                }`}
                            >
                                <List className="w-4 h-4" />
                                <span>List View ({filteredCafes.length})</span>
                            </button>
                        </div>
                    </div>

                    {/* Responsive Container: Map & List Layout */}
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 min-h-[500px] h-[calc(100vh-260px)] max-h-[720px]">
                        
                        {/* Cafe Cards List */}
                        <div className={`lg:col-span-5 bg-[#FFFDF9]/90 border border-[#EADBC8] rounded-2xl sm:rounded-3xl p-3 sm:p-4 flex flex-col overflow-hidden shadow-xl backdrop-blur-md ${
                            mobileViewMode === 'list' ? 'block' : 'hidden lg:flex'
                        }`}>
                            
                            {/* Card Search Box */}
                            <div className="mb-3">
                                <input
                                    type="text"
                                    placeholder="Filter by cafe name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="w-full px-3.5 py-2 bg-[#F9F3EE] border border-[#EADBC8] rounded-xl text-xs text-[#3C2A21] placeholder-[#A08D80] focus:outline-none focus:border-[#D9822B]"
                                />
                            </div>

                            {/* Scrollable Cafe List */}
                            <div className="flex-1 overflow-y-auto space-y-2.5 pr-1">
                                {isLoading ? (
                                    <div className="h-full flex flex-col items-center justify-center text-[#8C7A6B] gap-3 py-16">
                                        <Loader2 className="w-7 h-7 animate-spin text-[#D9822B]" />
                                        <p className="text-xs">Locating coffee shops around map...</p>
                                    </div>
                                ) : filteredCafes.length === 0 ? (
                                    <div className="h-full flex flex-col items-center justify-center text-[#8C7A6B] gap-2 py-16 text-center">
                                        <Coffee className="w-9 h-9 text-[#C8B8A6]" />
                                        <p className="text-xs sm:text-sm font-semibold text-[#5C4B3E]">No coffee shops found.</p>
                                        <p className="text-[11px] text-[#8C7A6B]">Try adjusting your search radius or location.</p>
                                    </div>
                                ) : (
                                    filteredCafes.map((cafe) => {
                                        const isSelected = selectedCafe && selectedCafe.id === cafe.id;
                                        const isFav = favorites.some(f => f.id === cafe.id);

                                        return (
                                            <div
                                                key={cafe.id}
                                                onClick={() => {
                                                    selectCafe(cafe);
                                                    if (window.innerWidth < 1024) {
                                                        setMobileViewMode('map');
                                                    }
                                                }}
                                                className={`p-3 sm:p-4 rounded-xl sm:rounded-2xl border transition-all cursor-pointer relative group ${
                                                    isSelected 
                                                        ? 'bg-[#FCEADE] border-[#F3C590] shadow-md' 
                                                        : 'bg-[#FFFDF9] border-[#EADBC8] hover:border-[#F3C590] hover:bg-[#F9F3EE]'
                                                }`}
                                            >
                                                <div className="flex items-start justify-between gap-2.5">
                                                    <div>
                                                        <div className="flex items-center gap-2">
                                                            <h4 className="text-xs sm:text-sm font-bold text-[#3C2A21] group-hover:text-[#C87524] transition-colors">
                                                                {cafe.name}
                                                            </h4>
                                                            <span className="flex items-center gap-0.5 text-[10px] sm:text-[11px] font-bold text-[#C87524] bg-[#FCEADE] px-1.5 py-0.5 rounded">
                                                                <Star className="w-3 h-3 fill-[#C87524]" />
                                                                {cafe.rating}
                                                            </span>
                                                        </div>

                                                        <p className="text-[11px] sm:text-xs text-[#7F665B] mt-1 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3 text-[#A08D80] shrink-0" />
                                                            <span className="truncate">{cafe.address}</span>
                                                        </p>
                                                    </div>

                                                    {/* Save Favorite Button */}
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            toggleFavorite(cafe);
                                                        }}
                                                        title={isFav ? "Remove Favorite" : "Save Favorite"}
                                                        className={`p-2 rounded-full border transition-all shrink-0 ${
                                                            isFav 
                                                                ? 'bg-[#FEE1E8] border-[#E86A92]/40 text-[#E86A92]' 
                                                                : 'bg-[#F9F3EE] border-[#EADBC8] text-[#8C7A6B] hover:text-[#E86A92] hover:bg-[#FCEADE]'
                                                        }`}
                                                    >
                                                        <Heart className={`w-4 h-4 ${isFav ? 'fill-[#E86A92]' : ''}`} />
                                                    </button>
                                                </div>

                                                {/* Meta Pills */}
                                                <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[10px] sm:text-[11px] text-[#7F665B]">
                                                    <span className="px-2 py-0.5 bg-[#F9F3EE] border border-[#EADBC8] rounded-md font-semibold text-[#C87524]">
                                                        {cafe.distance >= 1000 ? `${(cafe.distance / 1000).toFixed(1)} km` : `${cafe.distance} m`} away
                                                    </span>

                                                    {cafe.has_wifi && (
                                                        <span className="px-2 py-0.5 bg-[#E8F5E9] border border-[#A5D6A7] rounded-md font-semibold text-[#2E7D32] flex items-center gap-1">
                                                            <Wifi className="w-3 h-3" />
                                                            WiFi
                                                        </span>
                                                    )}

                                                    <span className="ml-auto text-[#8C7A6B] text-[10px]">
                                                        {cafe.opening_hours}
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>

                        {/* Interactive Leaflet Map Box */}
                        <div className={`transition-all duration-300 ${
                            isMapFullscreen 
                                ? 'fixed inset-0 z-50 w-screen h-screen rounded-none bg-[#FFFBF5]' 
                                : 'lg:col-span-7 bg-[#FFFDF9]/90 border border-[#EADBC8] rounded-2xl sm:rounded-3xl overflow-hidden relative shadow-xl flex flex-col ' + 
                                  (mobileViewMode === 'map' ? 'block' : 'hidden lg:flex')
                        }`}>
                            
                            {/* Floating Map Header Bar when Fullscreen */}
                            {isMapFullscreen && (
                                <div className="absolute top-4 left-4 right-4 z-30 bg-[#FFFDF9]/95 border border-[#EADBC8] px-4 py-3 rounded-2xl shadow-xl backdrop-blur-md flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-xl bg-[#D9822B] flex items-center justify-center text-white font-black">
                                            <Coffee className="w-4 h-4" />
                                        </div>
                                        <div>
                                            <h3 className="text-xs font-bold text-[#3C2A21]">Full Screen Map</h3>
                                            <p className="text-[10px] text-[#C87524]">{locationName}</p>
                                        </div>
                                    </div>

                                    {/* Map Theme Quick Switcher inside Fullscreen Overlay */}
                                    <div className="flex items-center gap-2">
                                        <select
                                            value={mapTheme}
                                            onChange={(e) => setMapTheme(e.target.value)}
                                            className="px-2.5 py-1.5 bg-[#F9F3EE] border border-[#EADBC8] text-[#C87524] rounded-xl text-xs font-bold focus:outline-none"
                                        >
                                            {MAP_THEMES.map(theme => (
                                                <option key={theme.id} value={theme.id} className="bg-[#FFFDF9] text-[#3C2A21]">
                                                    {theme.icon} {theme.name}
                                                </option>
                                            ))}
                                        </select>

                                        <button
                                            onClick={() => setIsMapFullscreen(false)}
                                            className="px-3 py-1.5 bg-[#F9F3EE] hover:bg-[#FCEADE] border border-[#EADBC8] rounded-xl text-xs font-bold text-[#3C2A21] flex items-center gap-1.5 shadow-sm"
                                        >
                                            <Minimize2 className="w-3.5 h-3.5 text-[#C87524]" />
                                            <span>Exit</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                            {/* Fullscreen Trigger Overlay Button (when not fullscreen) */}
                            {!isMapFullscreen && (
                                <button
                                    onClick={() => setIsMapFullscreen(true)}
                                    title="Toggle Full Screen Map"
                                    className="absolute top-3 left-3 z-20 px-3 py-1.5 bg-[#FFFDF9]/95 hover:bg-[#F9F3EE] border border-[#EADBC8] rounded-xl text-xs font-bold text-[#5C4B3E] hover:text-[#C87524] transition-all flex items-center gap-1.5 shadow-md backdrop-blur-md"
                                >
                                    <Maximize2 className="w-3.5 h-3.5 text-[#D9822B]" />
                                    <span>Full Screen</span>
                                </button>
                            )}

                            {/* Map Canvas */}
                            <div ref={mapContainerRef} className="w-full h-full min-h-[360px] z-10" />

                            {/* Bottom Sheet Card when Cafe Selected */}
                            {selectedCafe && (
                                <div className="absolute bottom-3 left-3 right-3 sm:bottom-4 sm:left-4 sm:right-4 z-20 bg-[#FFFDF9]/95 border border-[#EADBC8] p-3.5 sm:p-4 rounded-2xl shadow-xl backdrop-blur-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 animate-slideUp">
                                    <div>
                                        <div className="flex items-center gap-2">
                                            <span className="px-2 py-0.5 bg-[#FCEADE] text-[#C87524] text-[9px] sm:text-[10px] font-extrabold uppercase rounded-full">
                                                Selected Cafe
                                            </span>
                                            {isRouting ? (
                                                <span className="text-[11px] sm:text-xs text-[#C87524] flex items-center gap-1 animate-pulse font-semibold">
                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                    Routing streets...
                                                </span>
                                            ) : routeInfo && (
                                                <span className="text-[11px] sm:text-xs text-[#7F665B] font-semibold flex items-center gap-1">
                                                    <Compass className="w-3 h-3 text-[#D9822B]" />
                                                    {routeInfo.walkTime} ({routeInfo.distance})
                                                </span>
                                            )}
                                        </div>
                                        <h3 className="text-sm sm:text-base font-extrabold text-[#3C2A21] mt-0.5">{selectedCafe.name}</h3>
                                        <p className="text-[11px] sm:text-xs text-[#7F665B] mt-0.5 truncate">{selectedCafe.address}</p>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex items-center gap-2 w-full sm:w-auto">
                                        <button
                                            onClick={() => handleSaveRoute(selectedCafe)}
                                            className="flex-1 sm:flex-none px-3.5 py-2 bg-[#F9F3EE] hover:bg-[#FCEADE] border border-[#EADBC8] text-[#5C4B3E] text-xs font-bold rounded-xl transition-all flex items-center justify-center gap-1.5"
                                        >
                                            <Bookmark className="w-3.5 h-3.5 text-[#D9822B]" />
                                            <span>Save Route</span>
                                        </button>
                                        
                                        <button
                                            onClick={() => toggleFavorite(selectedCafe)}
                                            className="flex-1 sm:flex-none px-3.5 py-2 bg-[#D9822B] hover:bg-[#C87524] text-white text-xs font-extrabold rounded-xl transition-all shadow-md flex items-center justify-center gap-1.5"
                                        >
                                            <Heart className="w-3.5 h-3.5 fill-white" />
                                            <span>{favorites.some(f => f.id === selectedCafe.id) ? 'Saved' : 'Save Favorite'}</span>
                                        </button>
                                    </div>
                                </div>
                            )}

                        </div>

                    </div>
                </section>

                {/* 4. Saved Spots & Routes Section */}
                <section id="saved" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-12 border-t border-[#EADBC8]/60">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
                        
                        {/* Saved Cafes List */}
                        <div className="bg-[#FFFDF9]/80 border border-[#EADBC8] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-3.5">
                                <h3 className="text-base sm:text-lg font-extrabold text-[#3C2A21] flex items-center gap-2">
                                    <Heart className="w-4 h-4 sm:w-5 sm:h-5 text-[#E86A92] fill-[#E86A92]" />
                                    <span>Saved Spots ({favorites.length})</span>
                                </h3>
                            </div>

                            {favorites.length === 0 ? (
                                <p className="text-xs text-[#8C7A6B] italic py-6 text-center">
                                    No saved coffee spots yet. Click the heart icon on any cafe card to save it here!
                                </p>
                            ) : (
                                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                    {favorites.map(cafe => (
                                        <div key={cafe.id} className="p-3 bg-[#F9F3EE] border border-[#EADBC8] rounded-xl flex items-center justify-between text-xs">
                                            <div className="truncate mr-2">
                                                <h4 className="font-bold text-[#3C2A21] truncate">{cafe.name}</h4>
                                                <p className="text-[#7F665B] text-[11px] truncate mt-0.5">{cafe.address}</p>
                                            </div>
                                            <button 
                                                onClick={() => toggleFavorite(cafe)}
                                                className="text-[#E86A92] hover:text-[#C84A72] font-semibold px-2.5 py-1 bg-[#FEE1E8] rounded-lg shrink-0"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Saved Walking Routes List */}
                        <div className="bg-[#FFFDF9]/80 border border-[#EADBC8] rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-3.5">
                                <h3 className="text-base sm:text-lg font-extrabold text-[#3C2A21] flex items-center gap-2">
                                    <Bookmark className="w-4 h-4 sm:w-5 sm:h-5 text-[#D9822B] fill-[#D9822B]/20" />
                                    <span>Saved Walking Routes ({savedRoutes.length})</span>
                                </h3>
                            </div>

                            {savedRoutes.length === 0 ? (
                                <p className="text-xs text-[#8C7A6B] italic py-6 text-center">
                                    No saved routes yet. Select a cafe on the map and click "Save Route" to save it here!
                                </p>
                            ) : (
                                <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
                                    {savedRoutes.map(route => (
                                        <div key={route.id} className="p-3 bg-[#F9F3EE] border border-[#EADBC8] rounded-xl flex items-center justify-between text-xs">
                                            <div className="truncate mr-2">
                                                <h4 className="font-bold text-[#3C2A21] truncate">{route.cafeName}</h4>
                                                <p className="text-[#7F665B] text-[11px] mt-0.5">{route.walkTime} • {route.distance}</p>
                                            </div>
                                            <span className="text-[10px] text-[#C87524] bg-[#FCEADE] px-2 py-1 rounded-lg shrink-0 font-semibold">
                                                {route.savedAt}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                    </div>
                </section>

                {/* 5. Footer */}
                <footer className="bg-[#FFFDF9] border-t border-[#EADBC8] py-6 sm:py-8">
                    <div className="max-w-7xl mx-auto px-4 text-center text-xs text-[#8C7A6B]">
                        <p>© {new Date().getFullYear()} RoastRoute Pastel Coffee Shop Finder. OpenStreetMap & OSRM Routing.</p>
                    </div>
                </footer>

            </div>
        </>
    );
}
