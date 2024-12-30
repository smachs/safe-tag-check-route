const express = require('express');
const cors = require('cors');
const { Client } = require("@googlemaps/google-maps-services-js");
const polyline = require('@googlemaps/polyline-codec');
const haversine = require('haversine'); // For distance calculation
const axios = require('axios');

const app = express();
app.use(express.json());
app.use(cors());

const GOOGLE_MAPS_API_KEY = "AIzaSyAFMw99I94DKzKrQG1VCGIDdCFcHjWB1q0"; // Substitua pela sua chave de API do Google Maps
const client = new Client({});

// Improved error handling for API requests
async function getRouteFromGoogleMaps(inicio, fim) {
  try {
    const response = await client.directions({
      params: {
        origin: inicio,
        destination: fim,
        key: GOOGLE_MAPS_API_KEY,
      },
      timeout: 5000, // Aumentado para evitar falhas por tempo curto
    });

    if (response.data.status === "OK") {
      return response.data.routes[0];
    } else {
      console.error("Error in Google Maps API request:", response.data.status);
      return null; // Indica erro ou trate adequadamente
    }
  } catch (error) {
    console.error("Error fetching directions from Google Maps:", error);
    return null; // Indica erro ou trate adequadamente
  }
}

// Function to check if a location is near a polyline
function isLocationNearPolyline(ponto, polyline, tolerance) {
  const point = { latitude: ponto.lat, longitude: ponto.lng };

  for (let i = 0; i < polyline.length - 1; i++) {
    const start = { latitude: polyline[i][0], longitude: polyline[i][1] };
    const end = { latitude: polyline[i + 1][0], longitude: polyline[i + 1][1] };

    const distance = haversine(point, closestPointOnSegment(start, end, point), { unit: 'meter' });
    console.log("🚀 ~ isLocationNearPolyline ~ distance:", distance, distance <= tolerance);
    if (distance <= tolerance) {
      return true;
    }
  }

  return false;
}

// Helper function to find the closest point on a segment to a point
function closestPointOnSegment(start, end, point) {
  const dx = end.latitude - start.latitude;
  const dy = end.longitude - start.longitude;

  const u = ((point.latitude - start.latitude) * dx + (point.longitude - start.longitude) * dy) / (dx * dx + dy * dy);

  if (u < 0) {
    return start;
  }

  if (u > 1) {
    return end;
  }

  return {
    latitude: start.latitude + u * dx,
    longitude: start.longitude + u * dy,
  };
}

app.post('/calculate-distance', async (req, res) => {
  const { initial, destination } = req.body;

  if (!initial || !destination) {
    return res.status(400).json({ error: 'Origem e destino são obrigatórios.' });
  }

  try {
    const start = { lat: parseFloat(initial.split(",")[0]), lng: parseFloat(initial.split(",")[1]) };
    const end = { lat: parseFloat(destination.split(",")[0]), lng: parseFloat(destination.split(",")[1]) };
    const response = await axios.get('https://maps.googleapis.com/maps/api/distancematrix/json', {
      params: {
        origins: `${start.lat},${start.lng}`, // Corrigido de 'initials'
        destinations: `${end.lat},${end.lng}`,
        key: GOOGLE_MAPS_API_KEY,
      },
    });
    const data = response.data;

    if (data.status !== 'OK') {
      return res.status(500).json({ error: 'Erro ao buscar dados do Google Maps.' });
    }

    const element = data.rows[0].elements[0];
    if (element.status !== 'OK') {
      return res.status(400).json({ error: 'Não foi possível calcular a distância para os locais fornecidos.' });
    }

    const distanceInKm = element.distance.value / 1000; // distância em quilômetros
    const durationInMinutes = element.duration.value / 60; // duração em minutos

    res.json({
      distance: `${distanceInKm.toFixed(2)} km`,
      duration: `${durationInMinutes.toFixed(2)} minutos`,
    });
  } catch (error) {
    console.error('Erro ao calcular distância:', error.message);
    res.status(500).json({ error: 'Erro interno ao calcular distância.' });
  }
});

app.post('/validate-driver', async (req, res) => {
  const { initial, destination, actual, deviationRadius } = req.body;

  if (!initial || !destination || !actual || !deviationRadius) {
    return res.status(400).json({ error: "Dados de entrada incompletos." });
  }

  try {
    const inicio = { lat: parseFloat(initial.split(",")[0]), lng: parseFloat(initial.split(",")[1]) };
    const fim = { lat: parseFloat(destination.split(",")[0]), lng: parseFloat(destination.split(",")[1]) };
    const ponto = { lat: parseFloat(actual.split(",")[0]), lng: parseFloat(actual.split(",")[1]) };

    const route = await getRouteFromGoogleMaps(inicio, fim);
    if (!route) {
      return res.status(500).json({ error: "Erro ao obter rota do Google Maps." });
    }

    const decodedPolyline = polyline.decode(route.overview_polyline.points);
    const estaNaRota = isLocationNearPolyline(ponto, decodedPolyline, Number(deviationRadius)); // Ajuste da tolerância (em metros)

    res.json({ inRoute: estaNaRota });
  } catch (error) {
    console.error("Erro no processamento:", error);
    res.status(500).json({ error: "Erro interno no servidor." });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
