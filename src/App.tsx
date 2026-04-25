/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Search, 
  MapPin, 
  Thermometer, 
  Wind, 
  Droplets, 
  Calendar, 
  Download, 
  History, 
  Trash2, 
  Edit2, 
  ExternalLink, 
  Save, 
  X,
  Youtube,
  Navigation,
  Info
} from 'lucide-react';
import { 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer 
} from 'recharts';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { format, addDays } from 'date-fns';

import { auth } from './lib/firebase';
import { signInWithPopup, GoogleAuthProvider, onAuthStateChanged, User } from 'firebase/auth';
import { parseLocation, getFunFacts } from './services/geminiService';
import { fetchWeather, WeatherData, searchLocations } from './services/weatherService';
import { 
  createWeatherRecord, 
  getHistory, 
  updateRecord, 
  deleteRecord, 
  WeatherSearchRecord 
} from './services/dbService';
import { 
  exportToJSON, 
  exportToCSV, 
  exportToPDF, 
  exportToMarkdown 
} from './services/exportService';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [location, setLocation] = useState<any>(null);
  const [history, setHistory] = useState<WeatherSearchRecord[]>([]);
  const [startDate, setStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [funFacts, setFunFacts] = useState<string[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editTemp, setEditTemp] = useState<number>(0);
  const [info, setInfo] = useState<any>(null);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      if (u) {
        loadHistory();
      } else {
        setHistory([]);
      }
    });
    fetch('/api/info').then(res => res.json()).then(setInfo);
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const timer = setTimeout(async () => {
      if (query.length >= 2 && showSuggestions) {
        const results = await searchLocations(query);
        setSuggestions(results);
      } else {
        setSuggestions([]);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, showSuggestions]);

  const loadHistory = async () => {
    const data = await getHistory();
    if (data) setHistory(data);
  };

  const handleLogin = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query) return;
    setErrorMsg('');
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg("Start date must be before or equal to End date.");
      return;
    }
    setShowSuggestions(false);

    setLoading(true);
    try {
      // 1. Process Location with Gemini
      const loc = await parseLocation(query);
      setLocation(loc);

      // 2. Fetch Weather
      const weatherData = await fetchWeather(loc.lat, loc.lon, startDate, endDate);
      setWeather(weatherData);

      // 3. Get Fun Facts from Gemini
      const facts = await getFunFacts(loc.name);
      setFunFacts(facts);

      // 4. Save to Database (CREATE)
      await createWeatherRecord({
        locationName: loc.name,
        query: query,
        lat: loc.lat,
        lon: loc.lon,
        startDate: startDate,
        endDate: endDate,
        temperature: weatherData.current.temp,
        details: weatherData.current,
        userId: auth.currentUser?.uid || 'guest',
        notes: ''
      });

      loadHistory();
    } catch (err) {
      console.error(err);
      setErrorMsg("Error finding location or fetching weather.");
    } finally {
      setLoading(false);
    }
  };

  const handleSuggestionClick = async (sug: any) => {
    setQuery(sug.name);
    setErrorMsg('');
    if (new Date(startDate) > new Date(endDate)) {
      setErrorMsg("Start date must be before or equal to End date.");
      return;
    }
    setShowSuggestions(false);
    setLoading(true);
    try {
      const weatherData = await fetchWeather(sug.latitude, sug.longitude, startDate, endDate);
      setWeather(weatherData);
      setLocation({ name: sug.name, country: sug.country, lat: sug.latitude, lon: sug.longitude });
      const facts = await getFunFacts(sug.name);
      setFunFacts(facts);
      await createWeatherRecord({
        locationName: sug.name,
        query: sug.name,
        lat: sug.latitude,
        lon: sug.longitude,
        startDate,
        endDate,
        temperature: weatherData.current.temp,
        details: weatherData.current,
        userId: auth.currentUser?.uid || 'guest',
        notes: ''
      });
      loadHistory();
    } catch (err) {
      console.error(err);
      setErrorMsg("Error fetching weather for " + sug.name);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      // Optimistic update
      setHistory(prev => prev.filter(r => r.id !== id));
      await deleteRecord(id);
    } catch (err) {
      console.error("Delete failed", err);
      // Revert on error
      loadHistory();
      setErrorMsg("Failed to delete record.");
    }
  };

  const handleUpdate = async (id: string) => {
    setErrorMsg('');
    if (!editLocation.trim() || isNaN(editTemp)) {
      setErrorMsg("Invalid input for update.");
      return;
    }
    await updateRecord(id, { notes: editNotes, locationName: editLocation, temperature: editTemp });
    setIsEditing(null);
    setEditNotes('');
    setEditLocation('');
    setEditTemp(0);
    loadHistory();
  };

  const startEdit = (record: WeatherSearchRecord) => {
    setIsEditing(record.id!);
    setEditNotes(record.notes || '');
    setEditLocation(record.locationName || '');
    setEditTemp(record.temperature || 0);
  };

  const handleExport = (type: 'json' | 'csv' | 'pdf' | 'md') => {
    const filename = `weather-history-${format(new Date(), 'yyyy-MM-dd')}`;
    const data = history.map(h => ({
      ...h,
      createdAt: h.createdAt?.toDate?.()?.toISOString() || h.createdAt
    }));
    
    if (type === 'json') exportToJSON(data, filename);
    if (type === 'csv') exportToCSV(data, filename);
    if (type === 'pdf') exportToPDF(data, "SkyBound Weather History", filename);
    if (type === 'md') exportToMarkdown(data, filename);
  };

  return (
    <div className="min-h-screen bg-[#E4E3E0] text-[#141414] font-sans" onClick={() => setShowSuggestions(false)}>
      {/* Dynamic Header */}
      <header className="border-b border-[#141414] p-4 flex justify-between items-center bg-white/50 backdrop-blur-md sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#141414] rounded-lg flex items-center justify-center text-[#E4E3E0]">
            <Navigation className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tighter uppercase italic serif font-serif">Sahaj - Weather App</h1>
            <p className="text-[10px] opacity-60 uppercase tracking-widest font-mono">Atmospheric Intelligence v3.1</p>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          {user ? (
            <div className="bg-white border border-[#141414] rounded-full px-4 py-1.5 flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-xs font-bold uppercase tracking-widest opacity-60">Verified Access</span>
            </div>
          ) : (
            <button 
              onClick={handleLogin}
              className="bg-[#141414] text-white border border-[#141414] rounded-full px-4 py-1.5 flex items-center gap-2 hover:bg-[#2b2b2b]"
            >
              <span className="text-xs font-bold uppercase tracking-widest">Sign In</span>
            </button>
          )}
        </div>
      </header>

      {errorMsg && (
        <div className="max-w-7xl mx-auto px-4 w-full">
          <div className="bg-red-500/10 border border-red-500 text-red-500 px-4 py-3 rounded-xl flex justify-between items-center">
            <span className="text-sm font-bold">{errorMsg}</span>
            <button onClick={() => setErrorMsg('')} className="hover:opacity-70"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto p-6 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {!user ? (
          <div className="lg:col-span-12 flex flex-col items-center justify-center p-20 text-center">
             <div className="w-20 h-20 bg-[#141414]/5 rounded-full flex items-center justify-center mb-6">
                <Navigation className="w-10 h-10 opacity-20" />
              </div>
              <h2 className="text-2xl font-bold italic serif font-serif">Authorization Required</h2>
              <p className="max-w-sm mx-auto mt-4 text-sm opacity-60">
                Please sign in to access the Atmospheric Intelligence portal and perform weather queries.
              </p>
              <button 
                onClick={handleLogin}
                className="mt-6 bg-[#141414] text-[#E4E3E0] px-6 py-3 rounded-xl font-bold uppercase tracking-widest hover:translate-y-[-2px]"
              >
                Sign In with Google
              </button>
          </div>
        ) : (
          <>
            {/* Search & Config Panel */}
            <section className="lg:col-span-4 space-y-6">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white border border-[#141414] p-6 rounded-2xl shadow-[8px_8px_0px_#141414]"
          >
            <h2 className="text-xs font-bold uppercase tracking-widest opacity-40 mb-4 font-mono">Location Probe</h2>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 opacity-40" />
                <input 
                  type="text"
                  placeholder="Type a city name..."
                  className="w-full bg-[#f5f5f5] border border-[#141414] rounded-xl pl-10 pr-4 py-3 text-lg font-medium focus:ring-2 ring-[#141414] outline-none"
                  value={query}
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowSuggestions(true);
                  }}
                  onFocus={(e) => {
                    e.stopPropagation();
                    setShowSuggestions(true);
                  }}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setShowSuggestions(true);
                  }}
                />

                <AnimatePresence>
                  {showSuggestions && suggestions.length > 0 && (
                    <motion.div 
                      onClick={(e) => e.stopPropagation()}
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="absolute left-0 right-0 top-full mt-2 bg-white border border-[#141414] rounded-xl shadow-xl z-50 overflow-hidden"
                    >
                      {suggestions.map((sug, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => handleSuggestionClick(sug)}
                          className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-neutral-100 flex items-center justify-between group border-b border-neutral-100 last:border-0"
                        >
                          <div>
                            <span className="font-bold">{sug.name}</span>
                            <span className="text-[10px] opacity-40 uppercase ml-2">
                              {sug.admin1 ? `${sug.admin1}, ` : ''}{sug.country}
                            </span>
                          </div>
                          <Navigation className="w-3 h-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50 ml-1">Range Start</label>
                  <input 
                    type="date" 
                    className="w-full bg-[#f5f5f5] border border-[#141414] rounded-lg p-2 text-sm"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-bold uppercase opacity-50 ml-1">Range End</label>
                  <input 
                    type="date" 
                    className="w-full bg-[#f5f5f5] border border-[#141414] rounded-lg p-2 text-sm"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                  />
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-4 rounded-xl font-bold uppercase tracking-widest flex items-center justify-center gap-2 transition-all",
                  loading ? "bg-gray-200 cursor-not-allowed" : "bg-[#141414] text-[#E4E3E0] hover:translate-y-[-2px] active:translate-y-[0px]"
                )}
              >
                {loading ? "Searching..." : <><Navigation className="w-5 h-5" /> Execute Search</>}
              </button>
            </form>
          </motion.div>

          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-[#D1D0CC] border border-[#141414] p-4 rounded-2xl flex items-start gap-4"
          >
            <Info className="w-8 h-8 opacity-40 shrink-0" />
            <div>
              <h3 className="text-sm font-bold uppercase italic font-serif">PM Accelerator Project</h3>
              <p className="text-xs opacity-60 leading-relaxed mt-1">
                {info?.description || "Loading agency details..."}
              </p>
              <div className="mt-2 flex gap-2">
                <span className="text-[9px] bg-white px-2 py-0.5 rounded border border-[#141414] font-bold uppercase">React 19</span>
                <span className="text-[9px] bg-white px-2 py-0.5 rounded border border-[#141414] font-bold uppercase">Firebase</span>
                <span className="text-[9px] bg-white px-2 py-0.5 rounded border border-[#141414] font-bold uppercase">Gemini AI</span>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Results & Visualization */}
        <section className="lg:col-span-8 space-y-8">
          <AnimatePresence mode="wait">
            {weather && location ? (
              <motion.div 
                key="results"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="space-y-6"
              >
                {/* Hero Weather Card */}
                <div className="bg-[#141414] text-[#E4E3E0] p-8 rounded-[2.5rem] relative overflow-hidden flex flex-col md:flex-row gap-8 items-center">
                  <div className="z-10 text-center md:text-left space-y-2">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-[#E4E3E0]/60">
                      <MapPin className="w-4 h-4" />
                      <span className="uppercase text-xs font-bold tracking-widest">{location.name}, {location.country}</span>
                    </div>
                    <div className="text-8xl font-black italic serif font-serif tracking-tighter leading-none">
                      {Math.round(weather.current.temp)}°
                    </div>
                    <p className="text-2xl font-medium italic opacity-80">{weather.current.description}</p>
                    <div className="flex gap-6 mt-4 opacity-70">
                      <div className="flex items-center gap-2">
                        <Wind className="w-4 h-4" />
                        <span className="text-sm font-mono">{weather.current.windSpeed} km/h</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Droplets className="w-4 h-4" />
                        <span className="text-sm font-mono">{weather.current.humidity}% Humidity</span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex-1 w-full h-[200px] z-10">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={weather.daily}>
                        <Tooltip 
                          contentStyle={{ background: '#141414', border: '1px solid #E4E3E0', color: '#E4E3E0' }} 
                          itemStyle={{ color: '#E4E3E0' }}
                        />
                        <Line type="monotone" dataKey="tempMax" stroke="#E4E3E0" strokeWidth={3} dot={false} />
                        <Line type="monotone" dataKey="tempMin" stroke="#E4E3E0" strokeWidth={1} strokeDasharray="5 5" dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>

                  {/* Decorative Gradient */}
                  <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-blue-500/20 to-transparent blur-3xl pointer-events-none" />
                </div>

                {/* Additional Insights */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Fun Facts */}
                  <div className="bg-orange-50 border-2 border-orange-200 p-6 rounded-3xl space-y-4">
                    <h3 className="flex items-center gap-2 font-bold text-orange-800 uppercase italic font-serif">
                      <Info className="w-5 h-5" /> AI Insight & Fun Facts
                    </h3>
                    <ul className="space-y-3">
                      {funFacts.map((fact, i) => (
                        <li key={i} className="text-sm text-orange-900/70 border-l-2 border-orange-200 pl-4">
                          {fact}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Maps & Links */}
                  <div className="bg-blue-50 border-2 border-blue-200 p-6 rounded-3xl space-y-4">
                    <h3 className="flex items-center gap-2 font-bold text-blue-800 uppercase italic font-serif">
                      <MapPin className="w-5 h-5" /> Exploration Hub
                    </h3>
                    <div className="grid grid-cols-1 gap-3 text-sm">
                      <a 
                        href={`https://www.google.com/maps/search/${encodeURIComponent(location.name)}`}
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 bg-white/50 border border-blue-200 rounded-xl hover:bg-white transition-colors"
                      >
                        <span className="font-bold uppercase tracking-tight text-blue-900">View on Google Maps</span>
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <a 
                        href={`https://www.youtube.com/results?search_query=${encodeURIComponent(location.name + ' weather travel')}`}
                        target="_blank" 
                        rel="noreferrer"
                        className="flex items-center justify-between p-3 bg-white/50 border border-blue-200 rounded-xl hover:bg-white transition-colors"
                      >
                        <span className="font-bold uppercase tracking-tight text-blue-900">Explore on YouTube</span>
                        <Youtube className="w-4 h-4 text-red-500" />
                      </a>
                    </div>
                  </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-[400px] border-4 border-dashed border-[#141414]/10 rounded-[3rem] flex flex-col items-center justify-center text-center p-8"
              >
                <div className="w-20 h-20 bg-[#141414]/5 rounded-full flex items-center justify-center mb-6">
                  <Thermometer className="w-10 h-10 opacity-20" />
                </div>
                <h3 className="text-2xl font-bold opacity-40">Ready to probe the skies?</h3>
                <p className="max-w-xs text-sm opacity-40 mt-2">Enter a location above to retrieve real-time atmospheric data and AI-powered insights.</p>
              </motion.div>
            )}
          </AnimatePresence>

          {/* History / CRUD Section */}
          <section className="space-y-6">
            <div className="flex justify-between items-end border-b border-[#141414] pb-4">
              <div>
                <h2 className="text-2xl font-bold italic serif font-serif">Mission Log</h2>
                <p className="text-xs uppercase tracking-widest opacity-40 font-mono">Persistent Database Cache</p>
              </div>
              <div className="flex gap-2">
                <button 
                  onClick={() => handleExport('json')}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#141414] rounded-lg text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors"
                >
                  <Download className="w-3 h-3" /> JSON
                </button>
                <button 
                   onClick={() => handleExport('csv')}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#141414] rounded-lg text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors"
                >
                  <Download className="w-3 h-3" /> CSV
                </button>
                <button 
                   onClick={() => handleExport('pdf')}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#141414] rounded-lg text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors"
                >
                  <Download className="w-3 h-3" /> PDF
                </button>
                <button 
                   onClick={() => handleExport('md')}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-[#141414] rounded-lg text-[10px] font-bold uppercase hover:bg-[#141414] hover:text-white transition-colors"
                >
                  <Download className="w-3 h-3" /> MD
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {history.length === 0 ? (
                <p className="text-center py-12 text-sm opacity-40 italic">No historical records found for this frequency.</p>
              ) : (
                history.slice(0, 10).map((record) => (
                  <motion.div 
                    layout
                    key={record.id}
                    className="group bg-white border border-[#141414] p-4 rounded-2xl flex items-center justify-between hover:bg-neutral-50 transition-colors"
                  >
                    <div className="flex gap-4 items-center flex-1">
                      {isEditing === record.id ? (
                        <div className="w-12 h-12 bg-neutral-100 border border-blue-500 rounded-xl flex flex-col items-center justify-center p-1">
                          <input 
                            className="bg-transparent text-center font-bold text-xs w-full outline-none" 
                            type="number"
                            value={editTemp}
                            onChange={(e) => setEditTemp(Number(e.target.value))}
                          />
                        </div>
                      ) : (
                        <div className="w-12 h-12 bg-neutral-100 border border-[#141414] rounded-xl flex flex-col items-center justify-center">
                          <span className="text-xs font-black leading-none">{Math.round(record.temperature)}°</span>
                          <span className="text-[7px] uppercase font-bold opacity-40 mt-1">Temp</span>
                        </div>
                      )}
                      
                      <div className="flex-1">
                        {isEditing === record.id ? (
                          <div className="space-y-2 w-full max-w-sm">
                            <input 
                              className="w-full text-sm font-bold border-b border-[#141414] outline-none"
                              value={editLocation}
                              onChange={(e) => setEditLocation(e.target.value)}
                              placeholder="Location name"
                            />
                            <div className="flex gap-2">
                              <input 
                                className="flex-1 text-xs border border-[#141414] rounded px-2 py-1 outline-none"
                                value={editNotes}
                                onChange={(e) => setEditNotes(e.target.value)}
                                placeholder="Add notes..."
                              />
                              <button onClick={() => handleUpdate(record.id!)} className="text-green-600 p-1 hover:bg-green-50 rounded"><Save className="w-4 h-4" /></button>
                              <button onClick={() => setIsEditing(null)} className="text-gray-400 p-1 hover:bg-gray-50 rounded"><X className="w-4 h-4" /></button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <h4 className="font-bold text-sm leading-tight">{record.locationName}</h4>
                            <p className="text-[10px] opacity-50 flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {record.startDate} — {record.endDate}
                            </p>
                            {record.notes && <p className="text-[10px] bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded mt-1 italic text-yellow-800">"{record.notes}"</p>}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-3 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button 
                        onClick={() => startEdit(record)}
                        className="p-2 hover:bg-blue-50 text-blue-600 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => handleDelete(record.id!)}
                        className="p-2 hover:bg-red-50 text-red-600 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </section>
        </section>
        </>
        )}
      </main>

      <footer className="border-t border-[#141414] mt-20 p-8 text-center space-y-4 bg-white/30">
        <div className="flex justify-center gap-8 text-[10px] font-bold uppercase tracking-[0.2em] opacity-40">
          <span>{info?.name} Project</span>
          <span>Managed by {info?.pm_accelerator?.program}</span>
          <span>© 2026 Space-Time Continuum</span>
        </div>
        <p className="max-w-lg mx-auto text-xs opacity-50 leading-relaxed italic">
          "The PM Accelerator mission is to {info?.pm_accelerator?.mission.toLowerCase()}"
        </p>
      </footer>
    </div>
  );
}
