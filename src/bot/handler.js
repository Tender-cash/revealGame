/* eslint-disable prefer-destructuring */
const Logger = require("../logger");
const discordTranscripts = require("discord-html-transcripts");
const {
  RevealFirstResponse,
  SendReply,
  SendDefer,
  NotifyChannel,
  MessageToChannel,
  AdduserNameModalResponse,
  RevealCounterPartyAcceptResponse,
  RevealStartResponse,
  RevealWithdrawResponse,
} = require("./responses");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const duration = require("dayjs/plugin/duration");
const RevealService = require("../services/revealService");
const models = require("../models");
const { PermissionFlagsBits, ChannelType } = require("discord.js");
dayjs.extend(utc);
dayjs.extend(duration);

const FILETAG = "Handler";
const DELETE_TIMEOUT = 1000;
const TRANSCRIPT_CHANNEL = "reveal-transcripts";
const ESCROW_SUPPORT_ROLE = "escrow_support";
const LOG_CATEGORY = "reveal-logs";

const createReveal = async (client, interaction) => {
  const TAG = "createReveal";
  const userId = interaction.user.id;
  const serverId = interaction.guild.id;
  try {
    const revealF = await RevealService.CreateReveal(client, serverId, userId);
    if (revealF.error) return SendReply(interaction, revealF.message, true);
    return SendReply(interaction, revealF.message, true);
  } catch (error) {
    Logger.error(`${FILETAG}::${TAG}---${error}`);
  }
};

const addSecondPlayer = async (interaction) =>
  AdduserNameModalResponse(interaction);

const addPlayerTOReavel = async (client, message) => {
  try {
    const { channelId, guild } = message;
    const serverId = message.guild.id;
    const data = await models.Reveal.findOne({ channelId }).lean();
    if (!data) return SendReply(interaction, "Invalid Channel", true);
    const dataE = message.fields;
    if (!dataE) return SendReply(interaction, "invalid discord username", true);
    const userNameInput = dataE.getTextInputValue("username");
    const userName = userNameInput;
    if (!userName)
      return SendReply(interaction, "invalid discord username", true);
    let counterParty = null;
    let username = null;
    // const userName = us;
    if (userName.includes("@")) {
      const userN = userName.split("@")[1];
      username = userN;
      const res = await guild.members.fetch();
      counterParty = res.find(
        (member) =>
          `${member.user.username}#${member.user.discriminator}` === username
      );
    } else {
      username = userName;
      const guild = client.guilds.cache.get(serverId);
      const res = await guild.members.fetch();
      counterParty = res.find(
        (member) =>
          `${member.user.username}#${member.user.discriminator}` === username
      );
    }
    if (!counterParty) {
      SendReply(message, "Discord User not found on Server...");
      return;
    }
    if (counterParty.id === data.creator)
      return SendReply(message, "Can't Add Self as Counterparty");
    const ex = await message.guild.members.cache.get(counterParty.id);
    if (ex) {
      // add counterparty to discord channel and give permission
      message.channel.permissionOverwrites.edit(counterParty.id, {
        [PermissionFlagsBits.ViewChannel]: true,
        [PermissionFlagsBits.SendMessages]: true,
      });
    }
    // update add counterparty modal to disabled
    await RevealFirstResponse(
      message,
      { ...data, channelId: message.channelId, disabled: true },
      true
    );
    await SendReply(
      message,
      `<@${data.creator}> (id ${data.creator}) has added <@${counterParty.id}> (id ${counterParty.id}) as second player.`,
      false
    );
    // update Escrow with counterparty
    await RevealService.addCounterParty(counterParty.id, channelId);
    await RevealCounterPartyAcceptResponse(
      client,
      { ...data, counterparty: counterParty.id },
      false
    );
    return;
  } catch (error) {
    console.log("err", error);
  }
};

const acceptDeclineReveal = async (client, message, isAccepted = true) => {
  const { channelId } = message;
  const author = message.user.id;
  const accpData = await RevealService.CounterPartyPay(
    author,
    channelId,
    isAccepted
  );
  if (accpData.error) return SendReply(message, accpData.message, true);
  const escrow = accpData.data;
  if (isAccepted) {
    await MessageToChannel(
      message,
      `<@${escrow.counterparty}> (id ${escrow.counterparty}) has accepted the request to play`,
      false
    );
    await RevealCounterPartyAcceptResponse(
      message,
      { ...escrow, disabled: true },
      true
    );
    const revD = await RevealService.startRound(escrow.channelId, 1);
    if (revD.error) return SendReply(message, revD.message, true);
    // mark escrow as started
    return RevealStartResponse(
      client,
      { ...revD.data, message: revD.message },
      false
    );
  } else {
    // kick counterparty out of channel and set back to add counterparty
    message.channel.permissionOverwrites.delete(escrow.counterparty);
    // mark escrow as deposited
    await models.Reveal.updateOne(
      { channelId },
      {
        status: "waiting",
        counterparty: "",
      }
    );
    await RevealCounterPartyAcceptResponse(
      message,
      { ...escrow, disabled: true },
      true
    );
    await RevealFirstResponse(
      client,
      {
        channelId,
      },
      false
    );
    return SendReply(
      message,
      `<@${escrow.counterparty}> Has Declined the Escrow, Add a Second Player`,
      false
    );
  }
};

const makeSelection = async (client, message, data) => {
  const userId = message.user.id;
  const { channelId } = message;
  const { selection, round } = data;
  const playerSelect = await RevealService.playerSelect(
    channelId,
    round,
    userId,
    selection
  );
  if (playerSelect.error) return SendReply(message, playerSelect.message, true);
  await SendReply(message, playerSelect.message, false);
  if (playerSelect.nextRound && !playerSelect.roundended) {
    // MessageToChannel(message, `Next round`)
    const NextRound = parseFloat(round) + 1;
    // create new Round
    const revD = await RevealService.startRound(channelId, NextRound);
    if (revD.error) return SendReply(message, revD.message, true);
    return RevealStartResponse(
      client,
      { ...revD.data, message: revD.message },
      false
    );
  }
  if (playerSelect.roundended) {
    // send winnings to winner and close channel
    return RevealWithdrawResponse(
      client,
      {
        ...playerSelect.data,
        iswin: playerSelect.won,
        message: playerSelect.message,
      },
      false
    );
  }
  return;
};

const nextRoundSelect = async (client, message, data) => {
  const { channelId } = message;
  const author = message.user.id;
  const { round } = data;
  const nextRound = parseFloat(round) + 1;
  const revD = await RevealService.startRound(channelId, nextRound, true);
  if (revD.error) return SendReply(message, revD.message, true);
  await SendReply(message, `Round ${nextRound}`, false);
  // mark escrow as started
  return RevealStartResponse(
    client,
    { ...revD.data, message: revD.message },
    false
  );
};

const claimWins = async (client, message, data) => {
  const { channelId } = message;
  const author = message.user.id;
  const { round } = data;
  const clamData = await RevealService.claimWins(channelId, author);
  if (clamData.error) return SendReply(message, clamData.message, true);
  const Reveal = clamData.data;
  await SendReply(message, `<@${author}> has Withdrawn Wins`, false);
  await MessageToChannel(
    message,
    "Channel Will be Deleted in 10 seconds",
    false
  );
  const guild = message.guild;
  const everyoneRole = guild.roles.everyone;
  const supportRole = guild.roles.cache.find(
    (r) => r.name === ESCROW_SUPPORT_ROLE
  );

  let transcriptChannel = guild.channels.cache.find(
    (c) => c.name == TRANSCRIPT_CHANNEL && c.type == ChannelType.GuildText
  );
  if (!transcriptChannel) {
    let logCategory = guild.channels.cache.find(
      (c) => c.name == LOG_CATEGORY && c.type == ChannelType.GuildCategory
    );
    if (!logCategory) {
      // create log category
      logCategory = await guild.channels.create({
        name: LOG_CATEGORY,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          {
            type: "role",
            id: supportRole.id,
            allow: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
          {
            type: "role",
            id: everyoneRole.id,
            deny: [
              PermissionFlagsBits.ViewChannel,
              PermissionFlagsBits.SendMessages,
            ],
          },
        ],
      });
    }
    transcriptChannel = await guild.channels.create({
      name: TRANSCRIPT_CHANNEL,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          type: "role",
          id: supportRole.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
        {
          type: "role",
          id: everyoneRole.id,
          deny: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.SendMessages,
          ],
        },
      ],
    });
    transcriptChannel.setParent(logCategory.id);
  }
  // save channel transacript to transcript channel
  const attachment = await discordTranscripts.createTranscript(message.channel);
  transcriptChannel.send(
    `${Reveal.channelName} between <@${Reveal.creator}> (${Reveal.creator}) and <@${Reveal.counterparty}> (${Reveal.counterparty})`
  );
  transcriptChannel.send({
    files: [attachment],
  });
  setTimeout(async () => {
    // remove permission from creator
    await message.channel.permissionOverwrites.delete(Reveal.creator);
    // remove permission from counterparty
    if (Reveal.counterparty)
      await message.channel.permissionOverwrites.delete(Reveal.counterparty);
    // delete channel
    await message.channel.delete();
  }, DELETE_TIMEOUT);
};

module.exports = {
  createReveal,
  addSecondPlayer,
  addPlayerTOReavel,
  acceptDeclineReveal,
  makeSelection,
  nextRoundSelect,
  claimWins,
};
