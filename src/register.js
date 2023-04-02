const { REST, Routes } = require("discord.js");
const config = require("./config");
const commands = require("./commands.json");
const Logger = require("./logger");

const rest = new REST({ version: "10" }).setToken(config.BOT_TOKEN);

(async () => {
  try {
    Logger.info("Started refreshing application (/) commands.");
    await rest.put(Routes.applicationCommands(config.CLIENT_ID), {
      body: commands,
    });
    Logger.info("Successfully reloaded application (/) commands.");
  } catch (error) {
    Logger.error(error);
  }
})();
