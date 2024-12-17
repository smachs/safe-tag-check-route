const express = require('express');
const haversine = require('haversine');

const app = express();
app.use(express.json());

const ROUTE_MARGIN = 0.05; // Margin in kilometers

// Function to calculate if a driver is outside the route
const isDriverOutsideRoute = (initial, destination, actual, margin) => {
    // Check if the driver's current location is within the route corridor
    const distanceToInitial = haversine(initial, actual);
    const distanceToDestination = haversine(destination, actual);
    const totalRouteDistance = haversine(initial, destination);

    // Check if the driver is more than the margin away from the direct route
    return distanceToInitial + distanceToDestination > totalRouteDistance + margin;
};

// Endpoint to validate if the driver is outside the route
app.post('/validate-driver', (req, res) => {
    const { initial, destination, actual } = req.body;

    if (!initial || !destination || !actual) {
        return res.status(400).json({ error: 'Initial, destination, and actual coordinates are required.' });
    }

    const isOutside = isDriverOutsideRoute(initial, destination, actual, ROUTE_MARGIN);

    res.json({ isOutside });
});

// Start the server
const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
