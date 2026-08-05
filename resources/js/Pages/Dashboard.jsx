import AuthenticatedLayout from '@/Layouts/AuthenticatedLayout';
import { Head } from '@inertiajs/react';
import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { 
    Coffee, Navigation, Search, Heart, MapPin, 
    Loader2, RotateCw, CheckCircle, Clock, 
    Wifi, Compass, Star, ExternalLink, ChevronRight
} from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Default coordinates (e.g., Central Park, NY) if geolocation fails/denied
const DEFAULT_COORDS = { lat: 40.7829, lng: -73.9654, name: "Central Park, NY (Default)" };

export default function Dashboard() {
    // States
    const [userLocation, setUserLocation] = useState(null);
    const [locationName, setLocationName] = useState("Locating...");
    const [cafes, setCafes] = useState([]);
    const [favorites, setFavorites] = useState([]);
    const [selectedCafe, setSelectedCafe] = useState(null);
    const [routePath, setRoutePath] = useState(null);
    const [routeInfo, setRouteInfo] = useState(null); // { distance, duration }
    
    // Filters & controls
    const [radius, setRadius] = useState(1500); // meters
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // all, open, wifi, favorites
    const [isLoading, setIsLoading] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const [isSavingFavorite, setIsSavingFavorite] = useState(null); // holds osm_id being saved

    // Leaflet Ref
    const mapContainerRef = useRef(null);
    const mapRef = useRef(null);
    const markersLayerRef = useRef(null);
    const routeLineRef = useRef(null);

    // Initial load: Geolocation & Favorites
    useEffect(() => {
        fetchFavorites();
        detectLocation();
    }, []);

    // Fetch favorites from Laravel DB
    const fetchFavorites = async () => {
        try {
            const res = await axios.get('/favorites');
            setFavorites(res.data);
        } catch (err) {
            console.error("Failed to load favorites", err);
        }
    };

    // Detect browser geolocation
    const detectLocation = () => {
        setIsLoading(true);
        setErrorMsg(null);
        
        if (!navigator.geolocation) {
            setErrorMsg("Geolocation is not supported by your browser.");
            useFallbackLocation();
            return;
        }

        navigator.geolocation.getCurrentPosition(
            (position) => {
                const coords = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude
                };
                setUserLocation(coords);
                setLocationName("Current Location");
                fetchNearbyCafes(coords.lat, coords.lng, radius);
            },
            (error) => {
                console.warn("Geolocation error:", error.message);
                setErrorMsg("Location access denied or unavailable. Using default coordinates.");
                useFallbackLocation();
            },
            { enableHighAccuracy: true, timeout: 10000 }
        );
    };

    const useFallbackLocation = () => {
        setUserLocation({ lat: DEFAULT_COORDS.lat, lng: DEFAULT_COORDS.lng });
        setLocationName(DEFAULT_COORDS.name);
        fetchNearbyCafes(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng, radius);
    };

    // Fetch nearby coffee shops from Overpass API
    const fetchNearbyCafes = async (lat, lng, searchRadius) => {
        setIsLoading(true);
        setErrorMsg(null);
        
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
                const response = await fetch(url, {
                    headers: {
                        'User-Agent': 'RoastRouteCoffeeFinder/1.0 (contact@roastroute.app)'
                    }
                });
                
                if (response.ok) {
                    data = await response.json();
                    success = true;
                    break;
                } else {
                    console.warn(`Overpass mirror ${mirror} failed with status: ${response.status}`);
                }
            } catch (err) {
                console.warn(`Overpass mirror ${mirror} fetch error:`, err);
            }
        }

        if (!success) {
            setErrorMsg("Could not fetch nearby cafes. Overpass API servers are currently busy.");
            setIsLoading(false);
            return;
        }

        try {
            // Format and calculate distances
            const formattedCafes = (data.elements || []).map(element => {
                const distance = getDistance(lat, lng, element.lat, element.lon);
                
                // Parse street address
                let address = "Address not listed";
                if (element.tags) {
                    const street = element.tags['addr:street'] || '';
                    const num = element.tags['addr:housenumber'] || '';
                    const city = element.tags['addr:city'] || '';
                    if (street || num) {
                        address = `${num} ${street}${city ? ', ' + city : ''}`.trim();
                    }
                }

                return {
                    id: element.id,
                    name: element.tags.name || "Unnamed Coffee Shop",
                    lat: element.lat,
                    lon: element.lon,
                    address: address,
                    distance: distance, // in meters
                    opening_hours: element.tags.opening_hours || null,
                    website: element.tags.website || element.tags['contact:website'] || null,
                    phone: element.tags.phone || element.tags['contact:phone'] || null,
                    wifi: element.tags.wifi || element.tags.internet_access || null,
                    outdoor_seating: element.tags.outdoor_seating || null,
                };
            }).sort((a, b) => a.distance - b.distance);

            setCafes(formattedCafes);
        } catch (err) {
            console.error(err);
            setErrorMsg("Failed to parse coffee shop data.");
        } finally {
            setIsLoading(false);
        }
    };

    // Calculate distance between coords using Haversine
    const getDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371000; // Earth's radius in meters
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
            Math.sin(dLon/2) * Math.sin(dLon/2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
        return R * c;
    };

    // Toggle favorite state
    const handleToggleFavorite = async (e, cafe) => {
        e.stopPropagation();
        if (isSavingFavorite) return;
        
        const isFav = favorites.some(fav => fav.osm_id === cafe.id.toString());
        setIsSavingFavorite(cafe.id);

        try {
            if (isFav) {
                // Delete favorite
                await axios.delete(`/favorites/${cafe.id}`);
                setFavorites(prev => prev.filter(fav => fav.osm_id !== cafe.id.toString()));
            } else {
                // Save favorite
                const res = await axios.post('/favorites', {
                    osm_id: cafe.id.toString(),
                    name: cafe.name,
                    latitude: cafe.lat,
                    longitude: cafe.lon,
                    address: cafe.address
                });
                setFavorites(prev => [...prev, res.data]);
            }
        } catch (err) {
            console.error("Error updating favorite", err);
        } finally {
            setIsSavingFavorite(null);
        }
    };

    // Fetch walk route from OSRM
    const getWalkingRoute = async (cafe) => {
        if (!userLocation) return;
        setRoutePath(null);
        setRouteInfo(null);

        try {
            const url = `https://router.project-osrm.org/route/v1/walking/${userLocation.lng},${userLocation.lat};${cafe.lon},${cafe.lat}?geometries=geojson`;
            const res = await fetch(url);
            if (!res.ok) throw new Error("Routing failed");
            const data = await res.json();
            
            if (data.routes && data.routes[0]) {
                const route = data.routes[0];
                // Map from [lng, lat] to Leaflet [lat, lng]
                const coords = route.geometry.coordinates.map(coord => [coord[1], coord[0]]);
                setRoutePath(coords);
                setRouteInfo({
                    distance: route.distance, // meters
                    duration: route.duration // seconds
                });
            }
        } catch (err) {
            console.error("Could not fetch route from OSRM", err);
        }
    };

    // Select Cafe Handler
    const handleSelectCafe = (cafe) => {
        setSelectedCafe(cafe);
        getWalkingRoute(cafe);

        if (mapRef.current) {
            mapRef.current.setView([cafe.lat, cafe.lon], 16, { animate: true, duration: 1.0 });
        }
    };

    // Triggered on radius range slider change end
    const handleRadiusChangeComplete = () => {
        if (userLocation) {
            fetchNearbyCafes(userLocation.lat, userLocation.lng, radius);
        }
    };

    // Re-detect/Refetch on current position
    const handleRefresh = () => {
        if (userLocation) {
            fetchNearbyCafes(userLocation.lat, userLocation.lng, radius);
        } else {
            detectLocation();
        }
    };

    // Initialize Map on mount/userLocation load
    useEffect(() => {
        if (!mapContainerRef.current) return;

        // Clean up previous map if exists
        if (mapRef.current) {
            mapRef.current.remove();
            mapRef.current = null;
        }

        // Default to user location or NYC default
        const startLat = userLocation ? userLocation.lat : DEFAULT_COORDS.lat;
        const startLng = userLocation ? userLocation.lng : DEFAULT_COORDS.lng;

        // Initialize Map
        const map = L.map(mapContainerRef.current, {
            zoomControl: false // Custom placement later
        }).setView([startLat, startLng], 14);
        mapRef.current = map;

        // Add Premium Dark Matter Tiles
        L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
            subdomains: 'abcd',
            maxZoom: 20
        }).addTo(map);

        // Add standard zoom control at bottom-right
        L.control.zoom({ position: 'bottomright' }).addTo(map);

        // Initialize Markers Layer Group
        const markersLayer = L.layerGroup().addTo(map);
        markersLayerRef.current = markersLayer;

        return () => {
            if (mapRef.current) {
                mapRef.current.remove();
                mapRef.current = null;
            }
        };
    }, [userLocation === null]); // Run only when map container mounts first time

    // Sync Map view when user location changes
    useEffect(() => {
        if (mapRef.current && userLocation) {
            mapRef.current.setView([userLocation.lat, userLocation.lng], 14);
        }
    }, [userLocation]);

    // Update Map Markers & Route when states change
    useEffect(() => {
        if (!mapRef.current || !markersLayerRef.current) return;

        // Clear existing markers
        markersLayerRef.current.clearLayers();

        // 1. Add User Location Marker
        if (userLocation) {
            const pulsingIcon = L.divIcon({
                className: 'user-marker-container',
                html: `
                    <div class="user-pulse-ring"></div>
                    <div class="user-marker-core"></div>
                `,
                iconSize: [24, 24],
                iconAnchor: [12, 12]
            });

            L.marker([userLocation.lat, userLocation.lng], { icon: pulsingIcon })
                .bindPopup("<b>You are here</b><br/>Looking for cafes nearby.")
                .addTo(markersLayerRef.current);
        }

        // 2. Add Cafe Markers
        filteredCafes.forEach(cafe => {
            const isFav = favorites.some(fav => fav.osm_id === cafe.id.toString());
            const isSel = selectedCafe && selectedCafe.id === cafe.id;

            const cafeIcon = L.divIcon({
                className: `cafe-marker-container ${isSel ? 'selected' : ''} ${isFav ? 'favorited' : ''}`,
                html: `
                    <div class="cafe-marker-pin">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="w-4 h-4 text-white">
                            <path d="M17 8h1a4 4 0 1 1 0 8h-1"/>
                            <path d="M3 8h14v9a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4Z"/>
                            <line x1="6" x2="14" y1="2" y2="2"/>
                        </svg>
                    </div>
                    <div class="cafe-marker-shadow"></div>
                `,
                iconSize: [36, 36],
                iconAnchor: [18, 36]
            });

            const marker = L.marker([cafe.lat, cafe.lon], { icon: cafeIcon });
            
            marker.on('click', () => {
                handleSelectCafe(cafe);
            });

            // Popup
            marker.bindPopup(`
                <div class="map-popup-card">
                    <h3 class="popup-title">${cafe.name}</h3>
                    <p class="popup-distance">${(cafe.distance / 1000).toFixed(2)} km away</p>
                    <p class="popup-address">${cafe.address}</p>
                </div>
            `);

            marker.addTo(markersLayerRef.current);
        });

        // 3. Update Route Path
        if (routeLineRef.current) {
            routeLineRef.current.remove();
            routeLineRef.current = null;
        }

        if (routePath && routePath.length > 0) {
            routeLineRef.current = L.polyline(routePath, {
                color: '#d97706', // Amber-600 coffee outline
                weight: 5,
                opacity: 0.85,
                lineCap: 'round',
                lineJoin: 'round',
                dashArray: '8, 8', // Dashing animation effect
                className: 'route-animate-line'
            }).addTo(mapRef.current);

            // Fit map to show both markers nicely
            const bounds = L.latLngBounds(routePath);
            mapRef.current.fitBounds(bounds, { padding: [50, 50] });
        }
    }, [cafes, selectedCafe, favorites, routePath, activeFilter, searchQuery]);

    // Filtering logic
    const filteredCafes = cafes.filter(cafe => {
        const matchesSearch = cafe.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                             cafe.address.toLowerCase().includes(searchQuery.toLowerCase());
        
        if (!matchesSearch) return false;

        if (activeFilter === 'favorites') {
            return favorites.some(fav => fav.osm_id === cafe.id.toString());
        }
        if (activeFilter === 'wifi') {
            return cafe.wifi && cafe.wifi !== 'no';
        }
        if (activeFilter === 'open') {
            // Overpass doesn't compute opening status, but if they list hours, we display/filter
            return cafe.opening_hours !== null;
        }

        return true;
    });

    // Helper for formatting walking time
    const formatDuration = (seconds) => {
        if (!seconds) return '';
        const mins = Math.round(seconds / 60);
        if (mins < 60) return `${mins} min walk`;
        const hrs = Math.floor(mins / 60);
        const remMins = mins % 60;
        return `${hrs}h ${remMins}m walk`;
    };

    return (
        <AuthenticatedLayout>
            <Head title="Coffee Finder Dashboard" />

            <div className="relative flex h-[calc(100vh-64px)] w-full overflow-hidden bg-zinc-950 text-zinc-100">
                {/* 1. SIDEBAR CONTAINER */}
                <aside className="z-10 flex h-full w-full flex-col border-r border-zinc-800/80 bg-zinc-900/95 shadow-2xl backdrop-blur-md sm:max-w-md">
                    {/* Header */}
                    <div className="border-b border-zinc-800/80 p-5">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-500 ring-1 ring-amber-500/20">
                                    <Coffee className="h-5 w-5" />
                                </div>
                                <div>
                                    <h1 className="font-heading text-lg font-bold tracking-tight text-white">RoastRoute</h1>
                                    <p className="flex items-center gap-1 text-xs text-zinc-400">
                                        <MapPin className="h-3 w-3 text-amber-500" />
                                        <span>{locationName}</span>
                                    </p>
                                </div>
                            </div>
                            <button 
                                onClick={handleRefresh}
                                className="flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-800 bg-zinc-900 text-zinc-400 hover:bg-zinc-800 hover:text-white transition duration-150"
                                title="Refresh data"
                            >
                                <RotateCw className="h-4 w-4" />
                            </button>
                        </div>

                        {/* Search Input */}
                        <div className="relative mt-4">
                            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-zinc-500" />
                            <input
                                type="text"
                                placeholder="Search cafes by name or street..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full rounded-xl border border-zinc-800 bg-zinc-950/60 py-2.5 pr-4 pl-10 text-sm placeholder-zinc-500 outline-none ring-offset-zinc-900 transition duration-150 focus:border-amber-600 focus:ring-2 focus:ring-amber-600/20 focus:ring-offset-2"
                            />
                        </div>

                        {/* Radius Filter */}
                        <div className="mt-4">
                            <div className="flex items-center justify-between text-xs font-semibold text-zinc-400">
                                <span className="flex items-center gap-1"><Compass className="h-3.5 w-3.5 text-amber-500" /> Search Radius</span>
                                <span className="text-amber-500">{(radius / 1000).toFixed(1)} km</span>
                            </div>
                            <input
                                type="range"
                                min="500"
                                max="5000"
                                step="250"
                                value={radius}
                                onChange={(e) => setRadius(parseInt(e.target.value))}
                                onMouseUp={handleRadiusChangeComplete}
                                onTouchEnd={handleRadiusChangeComplete}
                                className="mt-2 h-1.5 w-full cursor-pointer appearance-none rounded-lg bg-zinc-800 accent-amber-500"
                            />
                            <div className="mt-1 flex justify-between text-[10px] text-zinc-500">
                                <span>0.5 km</span>
                                <span>2.5 km</span>
                                <span>5.0 km</span>
                            </div>
                        </div>

                        {/* Quick filter chips */}
                        <div className="mt-4 flex gap-1.5">
                            <button
                                onClick={() => setActiveFilter('all')}
                                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition duration-150 ${activeFilter === 'all' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/15' : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white'}`}
                            >
                                All
                            </button>
                            <button
                                onClick={() => setActiveFilter('favorites')}
                                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition duration-150 ${activeFilter === 'favorites' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/15' : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white'}`}
                            >
                                <Heart className="h-3 w-3 fill-current" /> Favorites ({favorites.length})
                            </button>
                            <button
                                onClick={() => setActiveFilter('wifi')}
                                className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition duration-150 ${activeFilter === 'wifi' ? 'bg-amber-600 text-white shadow-lg shadow-amber-600/15' : 'bg-zinc-800/60 text-zinc-400 border border-zinc-800 hover:bg-zinc-800 hover:text-white'}`}
                            >
                                <Wifi className="h-3 w-3" /> Free Wifi
                            </button>
                        </div>
                    </div>

                    {/* Cafe List Section */}
                    <div className="flex-1 overflow-y-auto p-4 scrollbar-thin scrollbar-thumb-zinc-800 scrollbar-track-transparent">
                        {isLoading ? (
                            <div className="flex h-64 flex-col items-center justify-center text-zinc-400 gap-3">
                                <Loader2 className="h-8 w-8 animate-spin text-amber-500" />
                                <p className="text-sm">Scanning coordinates for fresh brews...</p>
                            </div>
                        ) : errorMsg && cafes.length === 0 ? (
                            <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-zinc-400">
                                <div className="mb-3 rounded-full bg-red-500/10 p-3 text-red-500">
                                    <MapPin className="h-6 w-6" />
                                </div>
                                <p className="text-sm font-semibold text-white">{errorMsg}</p>
                                <button 
                                    onClick={detectLocation}
                                    className="mt-4 rounded-xl bg-amber-600 px-4 py-2 text-xs font-bold text-white hover:bg-amber-500 transition duration-150"
                                >
                                    Retry Location Access
                                </button>
                            </div>
                        ) : filteredCafes.length === 0 ? (
                            <div className="flex h-64 flex-col items-center justify-center p-6 text-center text-zinc-500">
                                <Coffee className="mb-3 h-8 w-8 text-zinc-600" />
                                <p className="text-sm">No coffee shops match your selection.</p>
                                <p className="text-xs mt-1">Try zooming out, expanding your radius, or clearing filters.</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider pl-1">
                                    {filteredCafes.length} {filteredCafes.length === 1 ? 'Cafe' : 'Cafes'} Found Nearby
                                </p>
                                {filteredCafes.map((cafe) => {
                                    const isFav = favorites.some(fav => fav.osm_id === cafe.id.toString());
                                    const isSel = selectedCafe && selectedCafe.id === cafe.id;

                                    return (
                                        <div
                                            key={cafe.id}
                                            onClick={() => handleSelectCafe(cafe)}
                                            className={`group relative flex cursor-pointer gap-4 rounded-2xl border p-4 transition-all duration-300 ${isSel ? 'border-amber-500/40 bg-amber-500/5 shadow-xl shadow-amber-500/5' : 'border-zinc-800/80 bg-zinc-900/40 hover:border-zinc-700 hover:bg-zinc-800/30'}`}
                                        >
                                            <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl transition duration-300 ${isSel ? 'bg-amber-600 text-white' : 'bg-zinc-800 text-zinc-400 group-hover:bg-zinc-700 group-hover:text-white'}`}>
                                                <Coffee className="h-5.5 w-5.5" />
                                            </div>

                                            <div className="flex-1 min-w-0">
                                                <h3 className="truncate text-sm font-bold text-white transition group-hover:text-amber-500">
                                                    {cafe.name}
                                                </h3>
                                                <p className="truncate text-xs text-zinc-400 mt-0.5">{cafe.address}</p>
                                                
                                                {/* Distance and Route Badge */}
                                                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                                                    <span className="inline-flex items-center rounded-md bg-zinc-800/90 px-2 py-0.5 text-[11px] font-medium text-zinc-300 ring-1 ring-inset ring-zinc-700/50">
                                                        {(cafe.distance / 1000).toFixed(2)} km away
                                                    </span>

                                                    {isSel && routeInfo && (
                                                        <span className="inline-flex items-center gap-1 rounded-md bg-amber-500/10 px-2 py-0.5 text-[11px] font-bold text-amber-500 ring-1 ring-inset ring-amber-500/20">
                                                            <Navigation className="h-2.5 w-2.5 fill-current" />
                                                            {formatDuration(routeInfo.duration)}
                                                        </span>
                                                    )}

                                                    {cafe.wifi && (
                                                        <span className="inline-flex items-center gap-0.5 rounded-md bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-medium text-blue-400 ring-1 ring-inset ring-blue-500/20">
                                                            <Wifi className="h-2.5 w-2.5" /> Wifi
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Action Bar (Favorites Toggle) */}
                                            <div className="flex flex-col justify-between items-end">
                                                <button
                                                    onClick={(e) => handleToggleFavorite(e, cafe)}
                                                    disabled={isSavingFavorite === cafe.id}
                                                    className={`rounded-lg p-2 transition duration-200 ${isFav ? 'text-rose-500 hover:bg-rose-500/10' : 'text-zinc-500 hover:bg-zinc-800 hover:text-zinc-300'}`}
                                                    title={isFav ? "Remove from favorites" : "Save to favorites"}
                                                >
                                                    {isSavingFavorite === cafe.id ? (
                                                        <Loader2 className="h-4.5 w-4.5 animate-spin" />
                                                    ) : (
                                                        <Heart className={`h-4.5 w-4.5 ${isFav ? 'fill-current' : ''}`} />
                                                    )}
                                                </button>
                                                <ChevronRight className="h-4 w-4 text-zinc-600 group-hover:text-zinc-400 transition" />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Selected Cafe Card Detail drawer (Pushed to bottom of sidebar on desktop) */}
                    {selectedCafe && (
                        <div className="border-t border-zinc-800/80 bg-zinc-950/80 p-5 backdrop-blur-md">
                            <div className="flex justify-between items-start gap-4">
                                <div className="min-w-0">
                                    <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest">Active Brew Spot</span>
                                    <h2 className="text-base font-bold text-white mt-1 truncate">{selectedCafe.name}</h2>
                                    <p className="text-xs text-zinc-400 mt-1">{selectedCafe.address}</p>
                                </div>
                                <button 
                                    onClick={() => { setSelectedCafe(null); setRoutePath(null); setRouteInfo(null); }}
                                    className="text-xs font-semibold text-zinc-500 hover:text-white transition"
                                >
                                    Clear
                                </button>
                            </div>

                            {/* Info list */}
                            <div className="mt-4 grid grid-cols-2 gap-2 text-xs">
                                {selectedCafe.opening_hours && (
                                    <div className="rounded-lg bg-zinc-900/60 p-2.5 border border-zinc-800/50">
                                        <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                                            <Clock className="h-3.5 w-3.5 text-amber-500" />
                                            Hours
                                        </div>
                                        <p className="mt-1 text-white font-medium truncate" title={selectedCafe.opening_hours}>
                                            {selectedCafe.opening_hours}
                                        </p>
                                    </div>
                                )}
                                {selectedCafe.outdoor_seating && (
                                    <div className="rounded-lg bg-zinc-900/60 p-2.5 border border-zinc-800/50">
                                        <div className="flex items-center gap-1.5 text-zinc-400 font-medium">
                                            <CheckCircle className="h-3.5 w-3.5 text-amber-500" />
                                            Patio Seating
                                        </div>
                                        <p className="mt-1 text-white font-medium capitalize">
                                            {selectedCafe.outdoor_seating}
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Action button */}
                            <div className="mt-4 flex gap-2">
                                <a 
                                    href={`https://www.google.com/maps/dir/?api=1&origin=${userLocation?.lat},${userLocation?.lng}&destination=${selectedCafe.lat},${selectedCafe.lon}&travelmode=walking`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-amber-600 py-2.5 text-xs font-bold text-white hover:bg-amber-500 shadow-lg shadow-amber-600/10 transition duration-150"
                                >
                                    <Navigation className="h-3.5 w-3.5 fill-current" /> Open in Google Maps
                                </a>
                                {selectedCafe.website && (
                                    <a 
                                        href={selectedCafe.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800 transition"
                                        title="Visit Website"
                                    >
                                        <ExternalLink className="h-4 w-4" />
                                    </a>
                                )}
                            </div>
                        </div>
                    )}
                </aside>

                {/* 2. MAP CONTAINER */}
                <main className="relative flex-1 h-full w-full">
                    {/* Leaflet Mount */}
                    <div id="map" ref={mapContainerRef} className="h-full w-full z-0"></div>

                    {/* Floating map controls */}
                    <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                        <button
                            onClick={detectLocation}
                            className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-900/90 border border-zinc-800 text-zinc-300 hover:text-white hover:bg-zinc-850 shadow-xl backdrop-blur-md transition"
                            title="Recenter Map"
                        >
                            <Compass className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Quick overview HUD if route active */}
                    {selectedCafe && routeInfo && (
                        <div className="absolute bottom-6 left-6 z-10 rounded-2xl bg-zinc-900/90 border border-zinc-800/80 p-4 shadow-2xl backdrop-blur-md max-w-xs transition-all duration-300">
                            <div className="flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-600/10 text-amber-500 ring-1 ring-amber-500/20">
                                    <Navigation className="h-5 w-5 fill-current rotate-45" />
                                </div>
                                <div>
                                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-wider">Estimated Route</p>
                                    <p className="text-sm font-bold text-white mt-0.5">
                                        {formatDuration(routeInfo.duration)}
                                    </p>
                                    <p className="text-xs text-zinc-500">
                                        {(routeInfo.distance / 1000).toFixed(2)} km walk route
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </AuthenticatedLayout>
    );
}
