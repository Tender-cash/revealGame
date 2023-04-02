/* eslint-disable indent */
const { createReveal, createWager, addSecondPlayer, addPlayerTOReavel, acceptDeclineReveal } = require("./handler");
const { SendReply } = require("./responses");
const Logger = require("../logger");
const FILETAG = "COMMANDS";

// Slash Command handler
const Commandhandler = (client, interaction) => {
  const TAG = "Commandhandler";
  try {
    switch (interaction.commandName) {
      case "reveal":
      case "wager":
        createReveal(client, interaction);
        break;
      default:
        SendReply(interaction, "Invalid command!!!");
        break;
    }
  } catch (error) {
    Logger.error(`${FILETAG}::${TAG}--- error::${error}`);
  }
};

// Button Command Handler
const ButtonHandler = (client, interaction, operation, data) => {
  const TAG = "ButtonHandler";
  try {
    switch (operation) {
      case "add-player":
        addSecondPlayer(interaction);
        break;
      case "accept-request":
        acceptDeclineReveal(client, interaction, true);
        break;
      case "decline-request":
        acceptDeclineReveal(client, interaction, false);
        break;
      default:
        SendReply(interaction, "Invalid button action!!!");
        break;
    }
  } catch (error) {
    Logger.error(`${FILETAG}::${TAG}--- error::${error}`);
  }
};

// Modal Command Handler
const ModalHandler = (client, interaction, operation, data) => {
  const TAG = "ModalHandler";
  try {
    switch (operation) {
      case "add-counterparty":
        return addPlayerTOReavel(client, interaction, data);
      default:
        SendReply(interaction, "Invalid modal action!!!");
        break;
    }
  } catch (error) {
    Logger.error(`${FILETAG}::${TAG}--- error::${error}`);
  }
};

module.exports = {
  Commandhandler,
  ButtonHandler,
  ModalHandler,
};
