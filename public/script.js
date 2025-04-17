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
            const response = await fetch(`${backendUrl}/generate-itinerary`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ dream }),
            });

            const itinerary = await response.json();
            if (itinerary.error) throw new Error(itinerary.error);

            let html = '<h2>Your Itinerary</h2>';
            if (itinerary.image) {
                html += `<img src="${itinerary.image}" alt="Destination Image" class="destination-image">`;
            }
            if (itinerary.destination) {
                html += `<h3>${itinerary.destination}</h3>`;
            }
            if (itinerary.group) {
                html += `<p><strong>Group:</strong> ${itinerary.group}</p>`;
            }
            if (itinerary.days) {
                html += `<p><strong>Duration:</strong> ${itinerary.days}</p>`;
            }
            if (itinerary.cost) {
                html += `<p><strong>Estimated Cost:</strong> ${itinerary.cost}</p>`;
            }
            if (itinerary.itinerary && itinerary.itinerary.length > 0) {
                itinerary.itinerary.forEach(day => {
                    html += `
                        <div class="day">
                            <h4>Day ${day.day}: ${day.location}</h4>
                            <p><strong>Accommodation:</strong> ${day.accommodation.name}${day.accommodation.link ? ` (<a href="${day.accommodation.link}" target="_blank">Book</a>)` : ''}</p>
                            <p><strong>Route:</strong> ${day.route.details}${day.route.link ? ` (<a href="${day.route.link}" target="_blank">View Route</a>)` : ''}</p>
                            <ul>
                                ${day.activities.map(activity => `<li>${activity.name}${activity.suggestion ? ` <em>(${activity.suggestion})</em>` : ''}</li>`).join('')}
                            </ul>
                        </div>
                    `;
                });
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
            const imageResponse = await fetch(`${backendUrl}/generate-image`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ destination: itinerary.destination || dream }),
            });

            const imageData = await imageResponse.json();
            const imageUrl = imageData.image || 'https://via.placeholder.com/150?text=No+Image';

            recentSearches.unshift({ destination: itinerary.destination || dream, imageUrl });
            if (recentSearches.length > 3) recentSearches.pop();
            localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
            displayRecentSearches();

            // Handle feedback form submission
            const tweakForm = document.getElementById('tweak-form');
            tweakForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                const feedback = document.getElementById('feedback').value;

                try {
                    const updatedResponse = await fetch(`${backendUrl}/generate-itinerary`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ dream, feedback }),
                    });

                    const updatedItinerary = await updatedResponse.json();
                    if (updatedItinerary.error) throw new Error(updatedItinerary.error);

                    let updatedHtml = '<h2>Your Updated Itinerary</h2>';
                    if (updatedItinerary.image) {
                        updatedHtml += `<img src="${updatedItinerary.image}" alt="Destination Image" class="destination-image">`;
                    }
                    if (updatedItinerary.destination) {
                        updatedHtml += `<h3>${updatedItinerary.destination}</h3>`;
                    }
                    if (updatedItinerary.group) {
                        updatedHtml += `<p><strong>Group:</strong> ${updatedItinerary.group}</p>`;
                    }
                    if (updatedItinerary.days) {
                        updatedHtml += `<p><strong>Duration:</strong> ${updatedItinerary.days}</p>`;
                    }
                    if (updatedItinerary.cost) {
                        updatedHtml += `<p><strong>Estimated Cost:</strong> ${updatedItinerary.cost}</p>`;
                    }
                    if (updatedItinerary.itinerary && updatedItinerary.itinerary.length > 0) {
                        updatedItinerary.itinerary.forEach(day => {
                            updatedHtml += `
                                <div class="day">
                                    <h4>Day ${day.day}: ${day.location}</h4>
                                    <p><strong>Accommodation:</strong> ${day.accommodation.name}${day.accommodation.link ? ` (<a href="${day.accommodation.link}" target="_blank">Book</a>)` : ''}</p>
                                    <p><strong>Route:</strong> ${day.route.details}${day.route.link ? ` (<a href="${day.route.link}" target="_blank">View Route</a>)` : ''}</p>
                                    <ul>
                                        ${day.activities.map(activity => `<li>${activity.name}${activity.suggestion ? ` <em>(${activity.suggestion})</em>` : ''}</li>`).join('')}
                                    </ul>
                                </div>
                            `;
                        });
                    }

                    resultDiv.innerHTML = updatedHtml;
                } catch (error) {
                    resultDiv.innerHTML = `<p>Error: ${error.message}</p>`;
                }
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