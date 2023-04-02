const { Client, Events, GatewayIntentBits, Partials } = require("discord.js");
const logger = require("../logger");
const { Commandhandler, ButtonHandler, ModalHandler } = require("./commands");
const { SendReply } = require("./responses");
const { HandleInstallProcess } = require("./install");
const { CronStart } = require("../crons");

const Bot = () => {
  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.DirectMessages,
      GatewayIntentBits.MessageContent,
    ],
  });

  client.once(Events.ClientReady, (c) => {
    logger.info(`Logged in as ${c.user.tag}!`);
    // set CronJOb
    CronStart(client);
  });

  client.on("interactionCreate", async (interaction) => {
    if (interaction.isCommand()) {
      return Commandhandler(client, interaction);
    } else if (interaction.isButton()) {
      const operation = JSON.parse(interaction.customId);
      return ButtonHandler(client, interaction, operation.id, operation.data);
    } else if (interaction.isModalSubmit()) {
      const operation = JSON.parse(interaction.customId);
      return ModalHandler(client, interaction, operation.id, operation.data);
    } else {
      return SendReply(interaction, "Invalid Request");
    }
  });

  client.on("guildCreate", (guild) => {
    // create server installation guide details and installation process
    return HandleInstallProcess(guild);
  });

  return client;
};

module.exports = {
  Bot,
};
