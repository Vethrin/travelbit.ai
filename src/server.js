const express = require('express');
const axios = require('axios');
const path = require('path');
require('dotenv').config();

// Initialize Express app
const app = express();
const port = process.env.PORT || 3000; // Use Render's assigned port

// Middleware to serve static files and parse JSON requests
app.use(express.static(path.join(__dirname, '../public')));
app.use(express.json());

// Load API keys from environment variables
const XAI_API_KEY = process.env.XAI_API_KEY;
const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const XAI_API_URL = 'https://api.x.ai/v1/chat/completions';
const XAI_IMAGE_API_URL = 'https://api.x.ai/v1/images/generations';

// Route to serve the main page and inject Google Maps script
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'), (err) => {
        if (err) {
            console.error('Error serving index.html:', err);
            return res.status(500).send('Error loading page');
        }
        const scriptContent = `
            document.getElementById('google-maps-script').src = 'https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=places';
        `;
        res.write(`<script>${scriptContent}</script>`);
        res.end();
    });
});

// Route to generate itinerary based on user input
app.post('/generate-itinerary', async (req, res) => {
    const { dream, feedback } = req.body;

    // Validate input
    if (!dream || typeof dream !== 'string') {
        return res.status(400).json({ error: 'Dream description is required and must be a string' });
    }

    try {
        // Construct prompt for Grok with clearer instructions
        let prompt = `
            Create a detailed travel itinerary based on this dream holiday description: "${dream}"
        `;
        
        // Add feedback to the prompt if provided
        if (feedback && typeof feedback === 'string' && feedback.trim()) {
            prompt += `\nAdjust the itinerary based on this feedback: "${feedback}"`;
        }

        prompt += `
            Include:
            - A day-by-day plan with specific locations
            - For each day: a recommended accommodation (just the name)
            - For each day: a driving route description (if applicable) or travel details
            - For each day: recommended travel-related activities (e.g., sightseeing, tours, cultural experiences; exclude unrelated activities like "checklist moving back")
            - Estimated total cost
            - Starting point and final destination must be specific locations (e.g., a city or airport); do not use "home" as a starting or ending point; infer a logical starting point like an airport or major city if not specified
            Return the response in pure JSON format (no Markdown, no \`\`\`json, just the raw JSON object) with this structure:
            {
                "destination": "",
                "startingPoint": "",
                "group": "",
                "days": "",
                "cost": "",
                "itinerary": [
                    {
                        "day": "",
                        "location": "",
                        "accommodation": {"name": ""},
                        "route": {"details": ""},
                        "activities": [{"name": ""}]
                    }
                ]
            }
        `;

        // Make request to Grok API for the itinerary
        const grokResponse = await axios.post(XAI_API_URL, {
            model: 'grok-beta',
            messages: [
                { role: 'system', content: 'You are a travel planning expert specializing in personalized trips.' },
                { role: 'user', content: prompt }
            ],
            max_tokens: 2000,
            temperature: 0.7
        }, {
            headers: {
                'Authorization': `Bearer ${XAI_API_KEY}`,
                'Content-Type': 'application/json'
            }
        });

        // Extract and clean the response content
        let rawContent = grokResponse.data.choices[0].message.content;
        rawContent = rawContent.replace(/^```json\s*\n?/, '').replace(/\n?\s*```$/, '');
        rawContent = rawContent.replace(/^```\s*\n?/, '').replace(/\n?\s*```$/, '');
        rawContent = rawContent.trim();

        // Parse the cleaned JSON response
        let itinerary;
        try {
            itinerary = JSON.parse(rawContent);
        } catch (error) {
            console.error('JSON Parse Error:', error.message, 'Raw Content:', rawContent);
            return res.status(500).json({ error: 'Failed to parse itinerary from response' });
        }

        // Validate itinerary structure
        if (!itinerary || !itinerary.itinerary || !Array.isArray(itinerary.itinerary)) {
            console.error('Invalid itinerary structure:', itinerary);
            return res.status(500).json({ error: 'Invalid itinerary structure received' });
        }

        // Generate an image based on the destination and dream description
        const imagePrompt = `Creative landscape photo of ${itinerary.destination}, showcasing its unique scenery with vibrant colors, reflecting in calm waters if applicable, with mountains or iconic landmarks in the background, capturing the ethereal beauty of the location as described in this dream holiday: "${dream}"`;

        let generatedImageBase64;
        try {
            const imageResponse = await axios.post(XAI_IMAGE_API_URL, {
                model: 'grok-2-image-1212',
                prompt: imagePrompt,
                n: 1, // Generate 1 image per request
                response_format: 'b64_json' // Request base64 format
            }, {
                headers: {
                    'Authorization': `Bearer ${XAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            // Extract the base64 string from the response
            if (imageResponse.data && imageResponse.data.data && imageResponse.data.data[0] && imageResponse.data.data[0].b64_json) {
                generatedImageBase64 = `data:image/jpeg;base64,${imageResponse.data.data[0].b64_json}`;
            } else {
                throw new Error('Invalid image generation response structure');
            }
        } catch (imageError) {
            console.error('Error generating image:', imageError.response ? imageError.response.data : imageError.message);
            // Fallback image if generation fails
            generatedImageBase64 = `https://via.placeholder.com/400x300?text=${encodeURIComponent(itinerary.destination || 'Destination')}`;
        }

        // Add the generated image to the itinerary
        itinerary.image = generatedImageBase64;

        // Enhance itinerary with links and suggestions
        for (let i = 0; i < itinerary.itinerary.length; i++) {
            let day = itinerary.itinerary[i];

            // Ensure required fields exist
            day.location = day.location || 'Unknown Location';
            day.accommodation = day.accommodation || { name: 'Not Specified' };
            day.accommodation.name = day.accommodation.name || 'Not Specified';
            day.route = day.route || { details: 'No route specified' };
            day.activities = day.activities || [];

            // Generate Google Maps route link with waypoints, skipping "home"
            let origin, destination;
            if (i === 0) {
                origin = itinerary.startingPoint;
            } else {
                origin = itinerary.itinerary[i - 1].location;
            }
            destination = day.location;

            // Skip route link if origin or destination is "home" or invalid
            if (origin.toLowerCase() !== 'home' && destination.toLowerCase() !== 'home' && origin && destination) {
                // Improved string cleaning: remove special characters, trim, and encode spaces
                const cleanString = (str) => {
                    return str
                        .replace(/[^a-zA-Z0-9\s-,.]/g, '') // Keep letters, numbers, spaces, hyphens, commas, and periods
                        .trim() // Remove leading/trailing spaces
                        .replace(/\s+/g, ' '); // Replace multiple spaces with a single space
                };

                origin = cleanString(origin);
                destination = cleanString(destination);

                // Only generate the link if both origin and destination are non-empty after cleaning
                if (origin && destination) {
                    const encodedOrigin = encodeURIComponent(origin);
                    const encodedDestination = encodeURIComponent(destination);
                    day.route.link = `https://www.google.com/maps/dir/?api=1&origin=${encodedOrigin}&destination=${encodedDestination}&travelmode=driving&key=${GOOGLE_MAPS_API_KEY}`;
                } else {
                    day.route.link = null; // No link if origin or destination is empty
                }
            } else {
                day.route.link = null; // No link if "home" is involved or if invalid
            }

            // Generate accommodation links, skipping if location is "home" or if Day 1 location matches startingPoint
            const isDay1AtStartingPoint = i === 0 && day.location.toLowerCase() === itinerary.startingPoint.toLowerCase();
            if (day.location.toLowerCase() !== 'home' && !isDay1AtStartingPoint) {
                const hotelName = day.accommodation.name.toLowerCase();
                const safeLocation = day.location.toLowerCase().replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-');
                // Generic link to Booking.com for any hotel
                day.accommodation.link = `https://www.booking.com/searchresults.html?ss=${encodeURIComponent(hotelName + ' ' + safeLocation)}`;
            } else {
                day.accommodation.link = null; // No link if location is "home" or Day 1 at starting point
                day.accommodation.name = 'N/A'; // Set accommodation to N/A
            }

            // Generate activity suggestions, filtering out irrelevant ones
            day.activities = day.activities.filter(activity => {
                const activityName = activity.name.toLowerCase();
                return !activityName.includes('checklist moving back');
            }).map(activity => {
                const activityName = activity.name.toLowerCase();
                let suggestion = '';

                // Generic suggestions based on activity type
                if (activityName.includes('museum') || activityName.includes('exhibition')) {
                    suggestion = 'Spend a couple of hours exploring; check for guided tours or audio guides for a deeper experience.';
                } else if (activityName.includes('hiking') || activityName.includes('hike')) {
                    suggestion = 'Wear sturdy shoes and bring water; check the weather forecast before heading out.';
                } else if (activityName.includes('beach') || activityName.includes('coast')) {
                    suggestion = 'Pack sunscreen and a hat; arrive early to enjoy a peaceful morning by the water.';
                } else if (activityName.includes('tour') || activityName.includes('safari') || activityName.includes('cruise')) {
                    suggestion = 'Book in advance to secure your spot; bring a camera for memorable photos.';
                } else if (activityName.includes('market') || activityName.includes('bazaar')) {
                    suggestion = 'Bring cash for small purchases; try local street food for an authentic experience.';
                } else if (activityName.includes('park') || activityName.includes('garden')) {
                    suggestion = 'Bring a picnic and enjoy a relaxing afternoon; check for seasonal flower displays.';
                } else if (activityName.includes('cultural') || activityName.includes('festival')) {
                    suggestion = 'Engage with locals to learn more; look for traditional performances or crafts.';
                } else if (activityName.includes('city center') || activityName.includes('downtown')) {
                    suggestion = 'Explore on foot to discover hidden gems; stop at a local café for a break.';
                } else if (activityName.includes('shopping') || activityName.includes('outlet')) {
                    suggestion = 'Arrive early to avoid crowds; look for local souvenirs to bring home.';
                } else if (activityName.includes('wildlife') || activityName.includes('zoo')) {
                    suggestion = 'Bring binoculars for a closer look; check feeding times for an interactive experience.';
                } else {
                    suggestion = 'Enjoy this activity at your own pace; ask locals for tips to enhance your experience.';
                }

                return {
                    name: activity.name,
                    suggestion: suggestion
                };
            });
        }

        // Send the enhanced itinerary to the client
        res.json(itinerary);
    } catch (error) {
        console.error('Error generating itinerary:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to generate itinerary. Check server logs for details.' });
    }
});

// Route to generate an image for a destination
app.post('/generate-image', async (req, res) => {
    const { destination } = req.body;

    // Validate input
    if (!destination || typeof destination !== 'string') {
        return res.status(400).json({ error: 'Destination is required and must be a string' });
    }

    try {
        // Generate an image based on the destination
        const imagePrompt = `Creative landscape photo of ${destination}, showcasing its unique scenery with vibrant colors, reflecting in calm waters if applicable, with mountains or iconic landmarks in the background, capturing the ethereal beauty of the location`;

        let generatedImageBase64;
        try {
            const imageResponse = await axios.post(XAI_IMAGE_API_URL, {
                model: 'grok-2-image-1212',
                prompt: imagePrompt,
                n: 1, // Generate 1 image per request
                response_format: 'b64_json' // Request base64 format
            }, {
                headers: {
                    'Authorization': `Bearer ${XAI_API_KEY}`,
                    'Content-Type': 'application/json'
                }
            });

            // Extract the base64 string from the response
            if (imageResponse.data && imageResponse.data.data && imageResponse.data.data[0] && imageResponse.data.data[0].b64_json) {
                generatedImageBase64 = `data:image/jpeg;base64,${imageResponse.data.data[0].b64_json}`;
            } else {
                throw new Error('Invalid image generation response structure');
            }
        } catch (imageError) {
            console.error('Error generating image:', imageError.response ? imageError.response.data : imageError.message);
            // Fallback image if generation fails
            generatedImageBase64 = `https://via.placeholder.com/400x300?text=${encodeURIComponent(destination || 'Destination')}`;
        }

        // Send the generated image
        res.json({ image: generatedImageBase64 });
    } catch (error) {
        console.error('Error in /generate-image:', error.response ? error.response.data : error.message);
        res.status(500).json({ error: 'Failed to generate image. Check server logs for details.' });
    }
});

// Error handling middleware to catch unhandled errors
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err.stack);
    res.status(500).json({ error: 'Internal server error' });
});

// Start the server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});