'use client'

import React, { useState, useEffect } from 'react';
import type { JSX } from 'react';
import dynamic from 'next/dynamic';
import './markerCluster.css';
import 'leaflet/dist/leaflet.css';
import { Calendar, Clock, MapPin, AlertTriangle, Search, Loader2 } from 'lucide-react';

// Importar el mapa dinámicamente sin SSR
const MapContainer = dynamic(() => import('react-leaflet').then((mod) => mod.MapContainer), {
  ssr: false,
  loading: () => <div className="h-96 bg-gray-200 animate-pulse rounded flex items-center justify-center">Cargando mapa...</div>
});

const TileLayer = dynamic(() => import('react-leaflet').then((mod) => mod.TileLayer), { ssr: false });


const MarkerClusterGroup = dynamic(
  () => import('react-leaflet-markercluster').then(mod => mod.default),
  { ssr: false }
) as React.ComponentType<React.PropsWithChildren<unknown>>;
const CircleMarker = dynamic(() => import('react-leaflet').then((mod) => mod.CircleMarker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then((mod) => mod.Popup), { ssr: false });

// Interfaces TypeScript
interface CrimePrediction {
  date: string;
  spatial_cluster: number;
  latitude: number;
  longitude: number;
  class_id: number;
  crime_type: string;
  probability: number;
}

type RiskLevel = 'Alto' | 'Medio' | 'Bajo' | 'Muy Bajo';

// Diccionario completo de clases de crímenes
const crimeClassDict: Record<number, string> = {
  0: "Liquor Law Violations",
  1: "Impersonation",
  2: "All Other Offenses",
  3: "Burglary/Breaking & Entering",
  4: "Credit Card/ATM Fraud",
  5: "Identity Theft",
  6: "False Pretenses",
  7: "Rape",
  8: "Welfare Fraud",
  9: "Wire Fraud",
  10: "Theft of Vehicle Parts",
  11: "Family Offenses (Nonviolent)",
  12: "Embezzlement",
  13: "Murder",
  14: "Aggravated Assault",
  15: "Fondling",
  16: "Theft From Vehicle",
  17: "Simple Assault",
  18: "Drug/Narcotic Violations",
  19: "Vandalism",
  20: "Counterfeiting",
  21: "Motor Vehicle Theft",
  22: "Theft From Building",
  23: "Pornography",
  24: "Intimidation",
  25: "All Other Larceny",
  26: "Shoplifting",
  27: "Trespassing",
  28: "DUI",
  29: "Arson",
  30: "Robbery",
  31: "Hacking",
  32: "Weapon Violations",
  33: "Disorderly Conduct",
  34: "Statutory Rape",
  35: "Sodomy",
  36: "Sexual Assault with Object",
  37: "Curfew Violations",
  38: "Stolen Property",
  39: "Coin Machine Theft",
  40: "Animal Cruelty",
  41: "Pocket-picking",
  42: "Drug Equipment Violations",
  43: "Purse-snatching",
  44: "Extortion",
  45: "Gambling Equipment",
  46: "Promoting Gambling",
  47: "Kidnapping",
  48: "Human Trafficking (Servitude)",
  49: "Bad Checks",
  50: "Prostitution",
  51: "Drunkenness",
  52: "Human Trafficking (Sex Acts)",
  53: "Incest",
  54: "Promoting Prostitution",
  55: "Peeping Tom",
  56: "Bribery"
};

// Función para determinar el color según la probabilidad
const getColorByProbability = (probability: number): string => {
  if (probability >= 0.5) return '#dc2626'; // red-600
  if (probability >= 0.2) return '#ea580c'; // orange-600
  if (probability >= 0.05) return '#2563eb'; // blue-600
  return '#16a34a'; // green-600
};

// Función para determinar el nivel de riesgo
const getRiskLevel = (probability: number): RiskLevel => {
  if (probability >= 0.5) return 'Alto';
  if (probability >= 0.2) return 'Medio';
  if (probability >= 0.05) return 'Bajo';
  return 'Muy Bajo';
};

// Componente principal
export default function CrimePredictionApp(): JSX.Element {
  const [predictions, setPredictions] = useState<CrimePrediction[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [selectedTime, setSelectedTime] = useState<string>('');
  const [topN, setTopN] = useState<number>(5);
  const [mapCenter, setMapCenter] = useState<[number, number]>([39.7392, -104.9903]); // Default: Denver
  const [isClient, setIsClient] = useState<boolean>(false);

  // Verificar si estamos en el cliente
  useEffect(() => {
    setIsClient(true);
  }, []);

  // Obtener fecha y hora actual por defecto
  useEffect(() => {
    const now = new Date();
    const date = now.toISOString().split('T')[0];
    const time = now.toTimeString().split(' ')[0].substring(0, 5);
    setSelectedDate(date);
    setSelectedTime(time);
  }, []);

  // Función para hacer la predicción
  const handlePredict = async (): Promise<void> => {
    if (!selectedDate || !selectedTime) {
      setError('Por favor selecciona fecha y hora');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const datetime = `${selectedDate}T${selectedTime}:00`;
      const response = await fetch(
        `http://localhost:8000/predict_crimes?datetime_str=${encodeURIComponent(datetime)}&top_n=${topN}`
      );

      if (!response.ok) {
        throw new Error('Error al obtener predicciones');
      }

      const data: CrimePrediction[] = await response.json();
      setPredictions(data);

      // Calcular centro del mapa basado en las predicciones
      if (data.length > 0) {
        const avgLat = data.reduce((sum, p) => sum + p.latitude, 0) / data.length;
        const avgLon = data.reduce((sum, p) => sum + p.longitude, 0) / data.length;
        setMapCenter([avgLat, avgLon]);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error desconocido');
    } finally {
      setLoading(false);
    }
  };



  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-red-600" />
            <h1 className="text-3xl font-bold text-gray-900">
              Predicción de Crímenes
            </h1>
          </div>
          <p className="text-gray-600 mt-2">
            Sistema de predicción de crímenes basado en análisis temporal y espacial
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel de control */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <Search className="w-5 h-5" />
                Parámetros de Predicción
              </h2>

              <div className="space-y-4">
                {/* Fecha */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Calendar className="w-4 h-4 inline mr-1" />
                    Fecha
                  </label>
                  <input
                    type="date"
                    value={selectedDate}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Hora */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    <Clock className="w-4 h-4 inline mr-1" />
                    Hora
                  </label>
                  <input
                    type="time"
                    value={selectedTime}
                    onChange={(e) => setSelectedTime(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>

                {/* Número de predicciones */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Top N Predicciones
                  </label>
                  <select
                    value={topN}
                    onChange={(e) => setTopN(parseInt(e.target.value))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={15}>15</option>
                    <option value={20}>20</option>
                  </select>
                </div>

                {/* Botón de predicción */}
                <button
                  onClick={handlePredict}
                  disabled={loading}
                  className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {loading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Prediciendo...
                    </>
                  ) : (
                    <>
                      <Search className="w-4 h-4" />
                      Predecir
                    </>
                  )}
                </button>

                {/* Error */}
                {error && (
                  <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-md">
                    {error}
                  </div>
                )}
              </div>

              {/* Leyenda de colores */}
              {predictions.length > 0 && (
                <div className="mt-6 p-4 bg-gray-50 rounded-md">
                  <h3 className="font-medium text-gray-900 mb-3">Leyenda de Riesgo</h3>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-red-600"></div>
                      <span className="text-sm">Alto (≥50%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-orange-600"></div>
                      <span className="text-sm">Medio (20-50%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-blue-600"></div>
                      <span className="text-sm">Bajo (5-20%)</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 rounded-full bg-green-600"></div>
                      <span className="text-sm">Muy Bajo (&lt;5%)</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Mapa y resultados */}
          <div className="lg:col-span-2 space-y-6">
            {/* Mapa */}
            {predictions.length > 0 && isClient && (
              <div className="bg-white rounded-lg shadow-sm overflow-hidden">
                <div className="p-4 border-b">
                  <h2 className="text-xl font-semibold flex items-center gap-2">
                    <MapPin className="w-5 h-5" />
                    Mapa de Predicciones
                  </h2>
                </div>
                <div className="h-96">
                  <MapContainer
                    center={mapCenter}
                    zoom={12}
                    style={{ height: '100%', width: '100%' }}
                  >
                    <TileLayer
                      url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                      attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    />
                    <MarkerClusterGroup>
                      {predictions.map((prediction, index) => (
                        <CircleMarker
                          key={index}
                          center={[prediction.latitude, prediction.longitude]}
                          radius={8}
                          color={getColorByProbability(prediction.probability)}
                          fillColor={getColorByProbability(prediction.probability)}
                          fillOpacity={0.7}
                          weight={2}
                        >
                          <Popup maxWidth={300}>
                            <div className="p-2">
                              <h3 className="font-semibold mb-2">
                                {crimeClassDict[prediction.class_id] || prediction.crime_type}
                              </h3>
                              <div className="space-y-1 text-sm">
                                <p><strong>Fecha:</strong> {new Date(prediction.date).toLocaleString()}</p>
                                <p><strong>Cluster:</strong> {prediction.spatial_cluster}</p>
                                <p><strong>Probabilidad:</strong> {(prediction.probability * 100).toFixed(2)}%</p>
                                <p><strong>Nivel de Riesgo:</strong>
                                  <span className={`ml-1 px-2 py-1 rounded text-xs ${getRiskLevel(prediction.probability) === 'Alto' ? 'bg-red-100 text-red-800' :
                                    getRiskLevel(prediction.probability) === 'Medio' ? 'bg-orange-100 text-orange-800' :
                                      getRiskLevel(prediction.probability) === 'Bajo' ? 'bg-blue-100 text-blue-800' :
                                        'bg-green-100 text-green-800'
                                    }`}>
                                    {getRiskLevel(prediction.probability)}
                                  </span>
                                </p>
                                <p><strong>Coordenadas:</strong> {prediction.latitude.toFixed(4)}, {prediction.longitude.toFixed(4)}</p>
                              </div>
                            </div>
                          </Popup>
                        </CircleMarker>
                      ))}
                    </MarkerClusterGroup>

                  </MapContainer>
                </div>
              </div>
            )}

            {/* Lista de predicciones */}
            {predictions.length > 0 && (
              <div className="bg-white rounded-lg shadow-sm">
                <div className="p-4 border-b">
                  <h2 className="text-xl font-semibold">Predicciones Detalladas</h2>
                </div>
                <div className="divide-y">
                  {predictions.map((prediction, index) => (
                    <div key={index} className="p-4 hover:bg-gray-50">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <h3 className="font-semibold text-gray-900 mb-1">
                            {crimeClassDict[prediction.class_id] || prediction.crime_type}
                          </h3>
                          <div className="text-sm text-gray-600 space-y-1">
                            <p>Cluster Espacial: {prediction.spatial_cluster}</p>
                            <p>Coordenadas: {prediction.latitude.toFixed(4)}, {prediction.longitude.toFixed(4)}</p>
                            <p>Fecha: {new Date(prediction.date).toLocaleString()}</p>
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="text-lg font-bold text-gray-900">
                            {(prediction.probability * 100).toFixed(2)}%
                          </div>
                          <div className={`text-sm px-2 py-1 rounded ${getRiskLevel(prediction.probability) === 'Alto' ? 'bg-red-100 text-red-800' :
                            getRiskLevel(prediction.probability) === 'Medio' ? 'bg-orange-100 text-orange-800' :
                              getRiskLevel(prediction.probability) === 'Bajo' ? 'bg-blue-100 text-blue-800' :
                                'bg-green-100 text-green-800'
                            }`}>
                            {getRiskLevel(prediction.probability)}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Estado vacío */}
            {!loading && predictions.length === 0 && (
              <div className="bg-white rounded-lg shadow-sm p-12 text-center">
                <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">
                  No hay predicciones
                </h3>
                <p className="text-gray-600">
                  Selecciona una fecha y hora para ver las predicciones de crímenes
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}