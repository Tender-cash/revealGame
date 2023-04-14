const { PermissionFlagsBits, ChannelType } = require("discord.js");
const models = require("../models");
const RevealService = require("../services/revealService");

const NOTIFICATION_CHANNEL = "reveal-notifications";

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
  // create reveal wallet if not existing
  await RevealService.createRevealWallet();
};

const createRequiredChannels = async (client, serverData) => {
  const guild = client;
  let onNChannel = "";
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
  // const everyoneRole = guild.roles.everyone;
  // const supportRole = guild.roles.cache.find(
  //   (r) => r.name === ESCROW_SUPPORT_ROLE
  // );

  // let transcriptChannel = guild.channels.cache.find(
  //   (c) => c.name == TRANSCRIPT_CHANNEL && c.type == ChannelType.GuildText
  // );
  // if (!transcriptChannel) {
  //   let logCategory = guild.channels.cache.find(
  //     (c) => c.name == LOG_CATEGORY && c.type == ChannelType.GuildCategory
  //   );
  //   if (!logCategory) {
  //     // create log category
  //     logCategory = await guild.channels.create({
  //       name: LOG_CATEGORY,
  //       type: ChannelType.GuildCategory,
  //       permissionOverwrites: [
  //         {
  //           type: "role",
  //           id: supportRole.id,
  //           allow: [
  //             PermissionFlagsBits.ViewChannel,
  //             PermissionFlagsBits.SendMessages,
  //           ],
  //         },
  //         {
  //           type: "role",
  //           id: everyoneRole.id,
  //           deny: [
  //             PermissionFlagsBits.ViewChannel,
  //             PermissionFlagsBits.SendMessages,
  //           ],
  //         },
  //       ],
  //     });
  //   }
  //   transcriptChannel = await guild.channels.create({
  //     name: TRANSCRIPT_CHANNEL,
  //     type: ChannelType.GuildText,
  //     permissionOverwrites: [
  //       {
  //         type: "role",
  //         id: supportRole.id,
  //         allow: [
  //           PermissionFlagsBits.ViewChannel,
  //           PermissionFlagsBits.SendMessages,
  //         ],
  //       },
  //       {
  //         type: "role",
  //         id: everyoneRole.id,
  //         deny: [
  //           PermissionFlagsBits.ViewChannel,
  //           PermissionFlagsBits.SendMessages,
  //         ],
  //       },
  //     ],
  //   });
  //   transcriptChannel.setParent(logCategory.id);
  // }
  return await models.Server.updateOne(
    { _id: serverData._id },
    {
      notificationRevealChannel: onNChannel.id,
      status: "active",
    }
  );
};

module.exports = {
  HandleInstallProcess,
};
