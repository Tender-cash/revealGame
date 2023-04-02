const Discord = require('discord.js');
const client = new Discord.Client();

client.on('message', async (message) => {
  if (message.content.startsWith('!start reveal')) {
    const user = message.mentions.users.first();
    if (!user) {
      return message.reply('Please mention a user to play the game with!');
    }

    // Create a new channel for the game
    const channel = await message.guild.channels.create('reveal-game', {
      type: 'text',
      topic: 'Reveal game channel',
      permissionOverwrites: [
        {
          id: message.guild.roles.everyone,
          deny: ['VIEW_CHANNEL'],
        },
        {
          id: message.author,
          allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
        },
        {
          id: user,
          allow: ['VIEW_CHANNEL', 'SEND_MESSAGES'],
        },
      ],
    });

    // Send instructions for the game
    const instructions = `Welcome to the Reveal game! ${message.author} will select a number between 1 and 20, and ${user} will try to guess it. To select a number, click the corresponding button below.`;
    const buttons = Array.from({ length: 20 }, (_, i) => new Discord.MessageButton().setCustomId(`${i + 1}`).setLabel(`${i + 1}`).setStyle('PRIMARY'));
    const row = new Discord.MessageActionRow().addComponents(buttons);
    channel.send({ content: instructions, components: [row] });

    // Initialize the game
    const game = {
      player1: message.author,
      player2: user,
      numbers1: Array.from({ length: 20 }, (_, i) => i + 1),
      numbers2: Array.from({ length: 20 }, (_, i) => i + 1),
      disabledNumbers: [],
      currentPlayer: message.author,
      pot: 0,
      channel,
    };

    // Start the game
    await playGame(game);
  }
});

async function playGame(game) {
  const { currentPlayer, channel } = game;

  // Send the player a DM with the available numbers
  const numbers = currentPlayer === game.player1 ? game.numbers1 : game.numbers2;
  const buttons = numbers.map((n) =>
    new Discord.MessageButton().setCustomId(`${n}`).setLabel(`${n}`).setStyle(game.disabledNumbers.includes(n) ? 'SECONDARY' : 'PRIMARY'),
  );
  const row = new Discord.MessageActionRow().addComponents(buttons);
  const message = `It's your turn to select a number. Available numbers:`;
  await currentPlayer.send({ content: message, components: [row] });

  // Wait for the player to select a number
  const filter = (i) => i.customId === `${i.customId}` && i.user.id === currentPlayer.id;
  const response = await channel.awaitMessageComponent({ filter, time: 30000 });
  const number = parseInt(response.customId, 10);

  // Hide the numbers and ask the other player to guess
  game.currentPlayer = game.currentPlayer === game.player1 ? game.player2 : game.player1;
  const guessMessage = `${currentPlayer} has selected a number. Guess the number by clicking the corresponding button below.`;
  const guessButtons = game.numbers1.map((n) =>
    new Discord.MessageButton().setCustomId(`${n}`).setLabel(`${n}`).setStyle(game.disabledNumbers.includes(n) ? 'SECONDARY' : 'PRIMARY'),
  );
  const guessRow = new Discord.MessageActionRow().addComponents(guessButtons);
  await channel.send({
