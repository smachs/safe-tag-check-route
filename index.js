const express = require('express');
const cors = require('cors');
const { Client } = require("@googlemaps/google-maps-services-js");
const polyline = require('@googlemaps/polyline-codec');
const haversine = require('haversine'); // For distance calculation

const app = express();
app.use(express.json());
app.use(cors());

const GOOGLE_MAPS_API_KEY = "AIzaSyAFMw99I94DKzKrQG1VCGIDdCFcHjWB1q0"; // Replace with your actual key

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
      timeout: 1000,
    });

    if (response.data.status === "OK") {
      return response.data.routes[0];
    } else {
      console.error("Error in Google Maps API request:", response.data.status);
      return null; // Indicate error or handle appropriately
    }
  } catch (error) {
    console.error("Error fetching directions from Google Maps:", error);
    return null; // Indicate error or handle appropriately
  }
}

// Improved `isLocationNearPolyline` function for clarity and efficiency
function isLocationNearPolyline(ponto, polyline, tolerance) {
  const point = { latitude: ponto.lat, longitude: ponto.lng };

  for (let i = 0; i < polyline.length - 1; i++) {
    const start = { latitude: polyline[i][0], longitude: polyline[i][1] };
    const end = { latitude: polyline[i + 1][0], longitude: polyline[i + 1][1] };

    const distance = haversine(point, closestPointOnSegment(start, end, point), { unit: 'km' });
    if (distance <= tolerance) {
      return true;
    }
  }

  return false;
}

// Helper function to find closest point on a segment to a point
function closestPointOnSegment(start, end, point) {
  const segmentLength = haversine(start, end, { unit: 'km' });
  if (segmentLength === 0) {
    return start; // Degenerate case: start and end are the same point
  }

  const u = ((point.latitude - start.latitude) * (end.latitude - start.latitude) +
    (point.longitude - start.longitude) * (end.longitude - start.longitude)) /
    (segmentLength * segmentLength);

  if (u < 0) {
    return start;
  }

  if (u > 1) {
    return end;
  }

  return {
    latitude: start.latitude + (u * (end.latitude - start.latitude)),
    longitude: start.longitude + (u * (end.longitude - start.longitude)),
  };
}

app.post('/validate-driver', async (req, res) => {
  const { initial, destination, actual } = req.body;

  if (!initial || !destination || !actual) {
    return res.status(400).json({ error: "Dados de entrada incompletos." });
  }

  try {
    const inicio = { lat: initial.split(",")[0], lng: initial.split(",")[1] };
    const fim = { lat: destination.split(",")[0], lng: destination.split(",")[1] };
    const ponto = { lat: actual.split(",")[0], lng: actual.split(",")[1] };

    const route = await getRouteFromGoogleMaps(inicio, fim);
    if (!route) {
      return res.status(500).json({ error: "Erro ao obter rota do Google Maps." });
    }

    const decodedPolyline = polyline.decode(route.overview_polyline.points);
    const estaNaRota = isLocationNearPolyline(ponto, decodedPolyline, 0.005); // Ajuste da tolerância Ex. 50 Mt

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