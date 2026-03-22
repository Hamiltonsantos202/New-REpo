const axios = require('axios');
const { ethers } = require('ethers');

const POLYMARKET_API = 'https://gamma-api.polymarket.com';
const CLOB_API = 'https://clob.polymarket.com';

// Fetch active markets from Polymarket
async function getMarkets() {
  const response = await axios.get(`${POLYMARKET_API}/markets`, {
    params: {
      active: true,
      closed: false,
      limit: 50,
      order: 'volume24hr',
      ascending: false
    }
  });

  return response.data
    .filter(m => m.outcomePrices && m.outcomePrices.length >= 2)
    .slice(0, 20)
    .map(m => {
      let prices;
      try {
        prices = typeof m.outcomePrices === 'string'
          ? JSON.parse(m.outcomePrices)
          : m.outcomePrices;
      } catch {
        prices = [0.5, 0.5];
      }

      return {
        id: m.id,
        conditionId: m.conditionId,
        question: m.question,
        yesPrice: parseFloat(prices[0]) || 0.5,
        noPrice: parseFloat(prices[1]) || 0.5,
        volume: m.volume || 0,
        endDate: m.endDate
      };
    });
}

// Place a bet on Polymarket
async function placeBet(bet) {
  try {
    const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
    const wallet = new ethers.Wallet(process.env.POLYMARKET_PRIVATE_KEY, provider);

    // For demo/testing — log the bet details
    console.log(`[BET] ${bet.side} on "${bet.question}" for $${bet.betSize}`);
    console.log(`[WALLET] ${wallet.address}`);

    // NOTE: Full CLOB order placement requires Polymarket API credentials
    // and EIP-712 signing. This logs the intent and returns a mock response.
    // To enable real betting, integrate with Polymarket's CLOB API using
    // their official SDK: https://github.com/Polymarket/py-clob-client

    return {
      success: true,
      txHash: 'simulation_mode',
      message: 'Bet logged (simulation mode — integrate CLOB SDK for live trading)'
    };
  } catch (err) {
    throw new Error('Bet placement failed: ' + err.message);
  }
}

module.exports = { getMarkets, placeBet };
