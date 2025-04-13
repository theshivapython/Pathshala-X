// Generate Explanation Function with Typing and AI Voice
async function generateExplanation() {
  const question = document.getElementById('question').value;
  const answer = document.getElementById('answer').value;
  const typing = document.getElementById('typing');
  const explanationText = document.getElementById('explanation-text');

  // Show typing animation
  typing.style.display = 'flex';
  explanationText.innerText = '';

  // Simulate AI thinking with delay
  setTimeout(async () => {
    try {
      // Call the backend API to generate the explanation
      const explanation = await getAIExplanation(question, answer);

      explanationText.innerText = explanation;
      typing.style.display = 'none';

      // AI Voice
      const utterance = new SpeechSynthesisUtterance(explanation);
      utterance.rate = 1;
      utterance.pitch = 1;
      utterance.lang = "en-US";
      speechSynthesis.speak(utterance);
    } catch (error) {
      explanationText.innerText = "Sorry, something went wrong while fetching the explanation.";
      console.error(error);
    }
  }, 2000);
}

// Function to get AI Explanation from your backend
async function getAIExplanation(question, answer) {
  const response = await fetch('/api/explanation', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ question, answer }),
  });

  if (!response.ok) {
    throw new Error(`Error: ${response.statusText}`);
  }

  const data = await response.json();
  return data.explanation.trim();
}

// Dark Mode Toggle
const toggleBtn = document.getElementById('toggle-mode');
toggleBtn.onclick = () => {
  document.body.classList.toggle('dark');
  toggleBtn.textContent = document.body.classList.contains('dark') ? '☀️ Light Mode' : '🌙 Dark Mode';
};
