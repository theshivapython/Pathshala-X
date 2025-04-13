export default async function handler(req, res) {
    const { question, answer } = req.body;
  
    const apiKey = process.env.OPENAI_API_KEY;
  
    const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [
          { role: "system", content: "You are a helpful assistant." },
          { role: "user", content: `Question: ${question}` },
          { role: "user", content: `Answer: ${answer}` },
        ],
      }),
    });
  
    const data = await openaiRes.json();
    const explanation = data.choices?.[0]?.message?.content;
  
    res.status(200).json({ explanation });
  }
  