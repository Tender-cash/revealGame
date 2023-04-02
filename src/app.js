const express = require("express");
const bodyParser = require("body-parser");
const cors = require("cors");
const helmet = require("helmet");
const { Bot } = require("./bot");
const { ConfirmTx } = require("./bot/handler");
const config = require("./config");
const databaseConnect = require("./config/database");
const Logger = require("./logger");

const StartApp = async () => {
  // initiate database
  await databaseConnect();

  // // start bot
  const bot = Bot();
  bot.login(config.BOT_TOKEN);

  const app = express();
  app.set("trust proxy", true);
  app.use(bodyParser.json());
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(helmet());
  app.use(cors());
  app.options("*", cors());
  const PORT = config.PORT || 5001;

  // Handles any requests that don't match the ones above
  app.get("/", async (req, res) => {
    return res.status(200).json({ online: "OK" });
  });

  app.get("/:id", async (req, res) => {
    Logger.info("transaction validate :::" + req.params.id);
    const resp = await ConfirmTx(req.params.id);
    if (resp) return res.status(200).json({ data: "valid tx" });
    return res.status(400).json({ data: "invalid tx" });
  });

  app.listen(PORT, () => Logger.info(`Validator listening on port ${PORT}!`));
};

module.exports = StartApp;
