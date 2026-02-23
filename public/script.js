const generateBtn = document.getElementById('generateBtn');
const reviewInput = document.getElementById('reviewInput');
const starRating = document.getElementById('starRating');
const resultSection = document.getElementById('resultSection');
const replyText = document.getElementById('replyText');
const approveBtn = document.querySelector('.btn-success.flex-grow-1');
const copyBtn = document.getElementById('copyBtn');

// 1. Generate AI Reply
generateBtn.addEventListener('click', async () => {
    const review = reviewInput.value;
    const stars = starRating.value;

    if (!review) return alert("Please paste a review!");

    generateBtn.innerText = "Processing...";
    generateBtn.disabled = true;

    try {
        const response = await fetch('/generate-review-reply', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ customerReview: review, starRating: stars })
        });

        const data = await response.json();
        if (data.success) {
            replyText.innerText = data.draft;
            resultSection.classList.remove('hidden');
        }
    } catch (error) {
        alert("Error connecting to server.");
    } finally {
        generateBtn.innerText = "Draft AI Reply";
        generateBtn.disabled = false;
    }
});

// 2. Copy to Clipboard (With Green Feedback)
copyBtn.addEventListener('click', () => {
    navigator.clipboard.writeText(replyText.innerText).then(() => {
        const originalText = copyBtn.innerText;
        copyBtn.innerText = "Copied!";
        copyBtn.classList.replace('btn-outline-success', 'btn-success');

        setTimeout(() => {
            copyBtn.innerText = originalText;
            copyBtn.classList.replace('btn-success', 'btn-outline-success');
        }, 1500);
    });
});

// 3. Approve Button
approveBtn.addEventListener('click', () => alert("Posted to Google!"));