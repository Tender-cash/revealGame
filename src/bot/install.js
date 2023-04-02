const { PermissionFlagsBits, ChannelType } = require("discord.js");
const models = require("../models");

const ONBOARDING_CHANNEL = "welcome-tender";
const NOTIFICATION_CHANNEL = "wager-notifications";

const HandleInstallProcess = async (client) => {
  // find server activefrom server List
  const exServer = await models.Server.findOne({ sId: client.id });
  if (!exServer) {
    // create new Server
    const serve = await models.Server.create({
      sId: client.id,
      name: client.name,
      icon: client.icon,
      ownerId: client.ownerId,
    });
    // create onboarding-channel for server admins
    await createRequiredChannels(client, serve);
  } else {
    await createRequiredChannels(client, exServer);
  }
};

const createRequiredChannels = async (client, serverData) => {
  const guild = client;
  // const everyoneRole = guild.roles.everyone;
  // checks if server has notification channel if not existing...
  if (!serverData.notificationChannel) {
    onNChannel = guild.channels.cache.find(
      (c) => c.name == NOTIFICATION_CHANNEL && c.type == ChannelType.GuildText
    );
    // create notification channel if not existing
    if (!onNChannel) {
      // create notification category
      onNChannel = await guild.channels.create({
        name: NOTIFICATION_CHANNEL,
        type: ChannelType.GuildText,
      });
    }
  }
  return await models.Server.updateOne(
    { _id: serverData._id },
    {
      notificationWagerChannel: onNChannel.id,
      status: "active",
    }
  );
};

module.exports = {
  HandleInstallProcess,
};
