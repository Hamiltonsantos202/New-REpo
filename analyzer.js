const MAX_BET = parseFloat(process.env.MAX_BET_SIZE) || 5;
const MIN_EDGE = parseFloat(process.env.MIN_EDGE) || 0.08; // 8% minimum edge

async function analyzeMarkets(markets, anthropic) {
  const suggestions = [];

  // Build a summary of markets for Claude to analyze
  const marketList = markets.map((m, i) =>
    `${i + 1}. "${m.question}" — YES: ${(m.yesPrice * 100).toFixed(1)}% | NO: ${(m.noPricePrice * 100 || (1 - m.yesPrice) * 100).toFixed(1)}% | Volume: $${Math.round(m.volume)}`
  ).join('\n');

  const prompt = `You are a prediction market analyst. Analyze these active Polymarket markets and identify the best betting opportunities based on your knowledge.

Markets:
${marketList}

For each market where you see a meaningful edge (your probability estimate differs from market by 8%+), respond with JSON array:
[
  {
    "marketIndex": 1,
    "side": "YES" or "NO",
    "claudeOdds": 65,
    "reasoning": "brief explanation under 100 chars",
    "confidence": 0.75
  }
]

Only include markets where you have genuine insight. If none, return [].
Respond ONLY with the JSON array, no other text.`;

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1000,
      messages: [{ role: 'user', content: prompt }]
    });

    const text = response.content[0].text.trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    for (const item of parsed) {
      const market = markets[item.marketIndex - 1];
      if (!market) continue;

      const marketOdds = item.side === 'YES'
        ? market.yesPrice * 100
        : (1 - market.yesPrice) * 100;

      const edge = item.claudeOdds - marketOdds;

      if (edge >= MIN_EDGE * 100) {
        // Scale bet size by confidence: $1 to MAX_BET
        const betSize = Math.min(
          MAX_BET,
          Math.max(1, Math.round(MAX_BET * item.confidence))
        ).toFixed(2);

        suggestions.push({
          question: market.question,
          marketId: market.id,
          conditionId: market.conditionId,
          side: item.side,
          marketOdds: marketOdds.toFixed(1),
          claudeOdds: item.claudeOdds,
          edge: edge.toFixed(1),
          betSize,
          reasoning: item.reasoning,
          confidence: item.confidence
        });
      }
    }
  } catch (err) {
    console.error('Claude analysis error:', err.message);
  }

  // Return top 3 suggestions max per scan
  return suggestions.slice(0, 3);
}

module.exports = { analyzeMarkets };
