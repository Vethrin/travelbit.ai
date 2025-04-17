// Load recent searches when the page loads
document.addEventListener('DOMContentLoaded', () => {
    displayRecentSearches();
});

document.getElementById('travel-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const dream = document.getElementById('dream').value;
    const resultDiv = document.getElementById('result');
    resultDiv.innerHTML = '<p>Loading...</p>';

    await generateItinerary(dream, resultDiv);
});

// Function to generate or tweak the itinerary
async function generateItinerary(dream, resultDiv, feedback = '') {
    try {
        const response = await fetch('/generate-itinerary', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ dream, feedback })
        });

        const data = await response.json();

        if (data.error) {
            resultDiv.innerHTML = `<p>Error generating itinerary: ${data.error}</p>`;
            return;
        }

        // Store the destination in localStorage
        storeRecentSearch(data.destination);

        // Render the itinerary with a destination picture
        let html = `
            <h3>${data.destination} Itinerary for ${data.group}</h3>
            <img src="${data.image}" alt="${data.destination}" class="destination-image">
            <p><strong>Starting Point:</strong> ${data.startingPoint}</p>
            <p><strong>Duration:</strong> ${data.days} days</p>
            <p><strong>Estimated Cost:</strong> ${data.cost}</p>
        `;

        data.itinerary.forEach(day => {
            html += `
                <div class="day">
                    <h4>Day ${day.day}: ${day.location}</h4>
                    <p><strong>Accommodation:</strong> 
                        ${day.accommodation.link ? `<a href="${day.accommodation.link}" target="_blank">${day.accommodation.name}</a>` : day.accommodation.name}
                    </p>
                    <p><strong>Route:</strong> ${day.route.details}
                        ${day.route.link ? ` (<a href="${day.route.link}" target="_blank">View Route</a>)` : ''}
                    </p>
                    <p><strong>Activities:</strong></p>
                    <ul>
                        ${day.activities.map(activity => `
                            <li>${activity.name}${activity.suggestion ? ` - <em>${activity.suggestion}</em>` : ''}</li>
                        `).join('')}
                    </ul>
                </div>
            `;
        });

        // Add feedback form at the bottom
        html += `
            <div id="feedback-form">
                <h3>Tweak Your Itinerary</h3>
                <form id="tweak-form">
                    <label for="feedback">What would you like to change? (e.g., "Add more hiking activities", "Reduce the budget")</label>
                    <textarea id="feedback" name="feedback" rows="4" required></textarea>
                    <button type="submit">Submit Feedback</button>
                </form>
            </div>
        `;

        resultDiv.innerHTML = html;

        // Add event listener for the feedback form
        document.getElementById('tweak-form').addEventListener('submit', async (e) => {
            e.preventDefault();
            const feedback = document.getElementById('feedback').value;
            resultDiv.innerHTML = '<p>Loading updated itinerary...</p>';
            await generateItinerary(dream, resultDiv, feedback);
        });

        // Update the recent searches display
        displayRecentSearches();
    } catch (error) {
        resultDiv.innerHTML = `<p>Error generating itinerary: ${error.message}</p>`;
    }
}

// Function to store recent searches in localStorage
function storeRecentSearch(destination) {
    let recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];
    // Avoid duplicates
    if (!recentSearches.includes(destination)) {
        recentSearches.unshift(destination); // Add to the beginning
        if (recentSearches.length > 3) {
            recentSearches = recentSearches.slice(0, 3); // Keep only the latest 3
        }
        localStorage.setItem('recentSearches', JSON.stringify(recentSearches));
    }
}

// Function to display recent searches with images
async function displayRecentSearches() {
    const recentSearchesDiv = document.getElementById('recent-searches');
    const recentSearches = JSON.parse(localStorage.getItem('recentSearches')) || [];

    if (recentSearches.length === 0) {
        recentSearchesDiv.innerHTML = '<p>No recent searches yet.</p>';
        return;
    }

    let html = '<div class="search-items">';
    for (const destination of recentSearches) {
        try {
            const response = await fetch('/generate-image', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ destination })
            });

            const data = await response.json();
            if (data.error) {
                console.error(`Error fetching image for ${destination}: ${data.error}`);
                continue;
            }

            html += `
                <div class="search-item">
                    <img src="${data.image}" alt="${destination}" class="search-image">
                    <p>${destination}</p>
                </div>
            `;
        } catch (error) {
            console.error(`Error fetching image for ${destination}: ${error.message}`);
        }
    }
    html += '</div>';

    recentSearchesDiv.innerHTML = html;
}