require('dotenv').config();
const { Telegraf, Markup } = require('telegraf');
const Anthropic = require('@anthropic-ai/sdk');
const { getMarkets, placeBet } = require('./polymarket');
const { analyzeMarkets } = require('./analyzer');

const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Store pending bets waiting for confirmation
const pendingBets = {};

// /start command
bot.start((ctx) => {
  ctx.reply(
    `👋 *Polymarket AI Bot*\n\nI scan markets, Claude analyzes them, and I ask you before placing any bet.\n\n` +
    `Commands:\n` +
    `/scan — Scan markets and get suggestions\n` +
    `/status — Bot status\n` +
    `/help — Show this menu`,
    { parse_mode: 'Markdown' }
  );
});

// /scan command — fetch markets and analyze with Claude
bot.command('scan', async (ctx) => {
  await ctx.reply('🔍 Scanning Polymarket... please wait.');

  try {
    const markets = await getMarkets();
    const suggestions = await analyzeMarkets(markets, anthropic);

    if (suggestions.length === 0) {
      return ctx.reply('🤷 No strong opportunities found right now. Try again later.');
    }

    for (const s of suggestions) {
      const id = `${Date.now()}${Math.floor(Math.random() * 1000)}`;
      pendingBets[id] = s;

      await ctx.reply(
        `📊 *${s.question}*\n\n` +
        `Market odds: ${s.marketOdds}%\n` +
        `Claude estimate: ${s.claudeOdds}%\n` +
        `Edge: +${s.edge}%\n` +
        `Side: *${s.side}*\n` +
        `Bet size: $${s.betSize}\n\n` +
        `💬 _${s.reasoning}_`,
        {
          parse_mode: 'Markdown',
          ...Markup.inlineKeyboard([
            Markup.button.callback('✅ Confirm Bet', `confirm_${id}`),
            Markup.button.callback('❌ Skip', `skip_${id}`)
          ])
        }
      );
    }
  } catch (err) {
    console.error(err);
    ctx.reply('❌ Error scanning markets: ' + err.message);
  }
});

// Handle confirm button
bot.action(/confirm_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  const bet = pendingBets[id];

  if (!bet) return ctx.answerCbQuery('⚠️ Bet expired or already handled.');

  try {
    await ctx.answerCbQuery('Placing bet...');
    const result = await placeBet(bet);
    delete pendingBets[id];
    await ctx.editMessageText(
      `✅ *Bet placed!*\n\n${bet.question}\nSide: ${bet.side} | Amount: $${bet.betSize}\nTx: ${result.txHash || 'confirmed'}`,
      { parse_mode: 'Markdown' }
    );
  } catch (err) {
    console.error(err);
    await ctx.editMessageText(`❌ Bet failed: ${err.message}`);
  }
});

// Handle skip button
bot.action(/skip_(.+)/, async (ctx) => {
  const id = ctx.match[1];
  delete pendingBets[id];
  await ctx.answerCbQuery('Skipped.');
  await ctx.editMessageText('⏭️ Skipped.');
});

// /status command
bot.command('status', (ctx) => {
  ctx.reply(
    `🟢 *Bot is running*\n\nPending confirmations: ${Object.keys(pendingBets).length}\nMax bet size: $${process.env.MAX_BET_SIZE || 5}`,
    { parse_mode: 'Markdown' }
  );
});

bot.command('help', (ctx) => {
  ctx.reply(
    `Commands:\n/scan — Scan markets\n/status — Bot status\n/help — This menu`,
    { parse_mode: 'Markdown' }
  );
});

bot.launch();
console.log('🤖 Polymarket bot started!');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
