document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('settings-form');
    const status = document.getElementById('status-msg');
    const googleBtn = document.getElementById('google-btn');

    // Fill the form with user data
    try {
        const response = await fetch('/api/user-data');
        
        if (response.ok) {
            const data = await response.json();

            // Populate profile fields
            document.getElementById('restaurant_name').value = data.restaurant_name || '';
            document.getElementById('owner_name').value = data.owner_name || '';
            document.getElementById('email').value = data.email || '';
            document.getElementById('cuisine_type').value = data.cuisine_type || '';
            document.getElementById('vibe').value = data.vibe || '';
            document.getElementById('usp').value = data.usp || '';

            // NEW: Check Google Status and update UI
            if (data.google_refresh_token) {
                googleBtn.classList.add('connected');
                
                // This removes the glitchy <img> tag and uses a clean checkmark emoji
                googleBtn.innerHTML = ` 
                    <span>Connected to Google Business</span>
                `;
    
                // This makes sure the button doesn't look like a clickable link anymore
                googleBtn.style.cursor = 'default';
                googleBtn.removeAttribute('href'); 
            }

        } else {
            status.innerText = "Please log in to manage your account.";
            status.style.color = "#f59e0b";
        }
    } catch (err) {
        console.error("Error loading user data:", err);
    }

    // Save form data on submit
    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        status.innerText = "Saving changes to database...";
        status.style.color = "#3b82f6";

        const updatedData = {
            restaurant_name: document.getElementById('restaurant_name').value,
            owner_name: document.getElementById('owner_name').value,
            email: document.getElementById('email').value,
            cuisine_type: document.getElementById('cuisine_type').value,
            vibe: document.getElementById('vibe').value,
            usp: document.getElementById('usp').value
        };

        try {
            const response = await fetch('/api/update-settings', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updatedData)
            });

            if (response.ok) {
                status.innerText = "Changes saved successfully! Your AI is now updated.";
                status.style.color = "#10b981";
            } else {
                throw new Error("Server responded with an error");
            }
        } catch (err) {
            console.error("Update error:", err);
            status.innerText = "Error: Could not save settings. Please try again.";
            status.style.color = "#ef4444";
        }
    });
});