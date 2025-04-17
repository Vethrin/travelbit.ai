document.addEventListener('DOMContentLoaded', () => {
    const form = document.getElementById('travel-form');
    const resultDiv = document.getElementById('result');
    const recentSearchesDiv = document.getElementById('recent-searches');

    // Dynamically determine the backend URL based on the current host
    const backendUrl = window.location.hostname === 'localhost' ? 'http://localhost:3000' : window.location.origin;

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        const dream = document.getElementById('dream').value;

        try {
            const response = await fetch(`${backendUrl}/api/itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dream }),
            });

            const itinerary = await response.json();
            if (itinerary.error) throw new Error(itinerary.error);

            let html = '<h2>Your Itinerary</h2>';
            if (itinerary.imageUrl) {
                html += `<img src="${itinerary.imageUrl}" alt="Destination Image" class="destination-image">`;
            }
            if (itinerary.destination) {
                html += `<h3>${itinerary.destination}</h3>`;
            }
            if (itinerary.accommodation) {
                html += `<p><strong>Accommodation:</strong> ${itinerary.accommodation}</p>`;
            }
            if (itinerary.route) {
                html += `<p><strong>Route:</strong> ${itinerary.route}</p>`;
            }
            if (itinerary.activities && itinerary.activities.length > 0) {
                html += '<h3>Activities</h3><ul>';
                itinerary.activities.forEach(activity => {
                    html += `<li>${activity}</li>`;
                });
                html += '</ul>';
            }

            // Feedback form for tweaking the itinerary
            html += `
                <div id="feedback-form">
                    <h3>Tweak Your Itinerary</h3>
                    <form id="tweak-form">
                        <label for="feedback">What would you like to change?</label>
                        <textarea id="feedback" name="feedback" rows="4" required></textarea>
                        <button type="submit">Submit Feedback</button>
                    </form>
                </div>
            `;

            resultDiv.innerHTML = html;

            // Add to recent searches
            let recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];
            const imageResponse = await fetch(`${backendUrl}/api/image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ destination: itinerary.destination || dream }),
            });
            const imageData = await imageResponse.json();
            const imageUrl = imageData.imageUrl || 'https://via.placeholder.com/150?text=No+Image';

            recentSearches.unshift({ destination: itinerary.destination || dream, imageUrl });
            if (recentSearches.length > 3) recentSearches.pop();
            localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
            displayRecentSearches();

            // Handle feedback form submission
            const tweakForm = document.getElementById('tweak-form');
            tweakForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const feedback = document.getElementById('feedback').value;
                const updatedDream = `${dream} - Feedback: ${feedback}`;

                const updatedResponse = await fetch(`${backendUrl}/api/itinerary`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({ dream: updatedDream }),
                });

                const updatedItinerary = await updatedResponse.json();
                if (updatedItinerary.error) throw new Error(updatedItinerary.error);

                let updatedHtml = '<h2>Your Updated Itinerary</h2>';
                if (updatedItinerary.imageUrl) {
                    updatedHtml += `<img src="${updatedItinerary.imageUrl}" alt="Destination Image" class="destination-image">`;
                }
                if (updatedItinerary.destination) {
                    updatedHtml += `<h3>${updatedItinerary.destination}</h3>`;
                }
                if (updatedItinerary.accommodation) {
                    updatedHtml += `<p><strong>Accommodation:</strong> ${updatedItinerary.accommodation}</p>`;
                }
                if (updatedItinerary.route) {
                    updatedHtml += `<p><strong>Route:</strong> ${updatedItinerary.route}</p>`;
                }
                if (updatedItinerary.activities && updatedItinerary.activities.length > 0) {
                    updatedHtml += '<h3>Activities</h3><ul>';
                    updatedItinerary.activities.forEach(activity => {
                        updatedHtml += `<li>${activity}</li>`;
                    });
                    updatedHtml += '</ul>';
                }

                resultDiv.innerHTML = updatedHtml;
            });

        } catch (error) {
            resultDiv.innerHTML = `<p>Error: ${error.message}</p>`;
        }
    });

    function displayRecentSearches() {
        const recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];
        let html = '<div class="search-items">';
        recentSearches.forEach(search => {
            html += `
                <div class="search-item">
                    <img src="${search.imageUrl}" alt="${search.destination}" class="search-image">
                    <p>${search.destination}</p>
                </div>
            `;
        });
        html += '</div>';
        recentSearchesDiv.innerHTML = html;
    }

    // Display recent searches on page load
    displayRecentSearches();
});