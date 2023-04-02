const Logger = require("../logger");
const {
  RevealFirstResponse,
  SendReply,
  SendDefer,
  NotifyChannel,
  MessageToChannel,
  AdduserNameModalResponse,
  RevealCounterPartyAcceptResponse,
  RevealStartResponse,
} = require("./responses");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const duration = require("dayjs/plugin/duration");
const RevealService = require("../services/revealService");
const models = require("../models");
const { PermissionFlagsBits } = require("discord.js");
dayjs.extend(utc);
dayjs.extend(duration);

const FILETAG = "Handler";

const twoDP = (n) => (n > 9 ? n : "0" + n);

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
    RevealFirstResponse(
      message,
      { ...data, channelId: message.channelId, disabled: true },
      true
    );
    // update Escrow with counterparty
    await RevealService.addCounterParty(counterParty.id, channelId);
    await RevealCounterPartyAcceptResponse(
      client,
      { ...data, counterparty: counterParty.id },
      false
    );
    MessageToChannel(
      message,
      `<@${data.creator}> (id ${data.creator}) has added <@${counterParty.id}> (id ${counterParty.id}) as counter-party.`,
      false
    );
    return SendReply(
      message,
      `<@${data.creator}> (id ${data.creator}) has added <@${counterParty.id}> (id ${counterParty.id}) as counter-party.`,
      true
    );
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
    // MessageToChannel(
    //   message,
    //   `<@${escrow.counterparty}> (id ${escrow.counterparty}) has accepted the request to play`
    // );
    // RevealCounterPartyAcceptResponse(
    //   message,
    //   { ...escrow, disabled: true },
    //   true
    // );
    const revD = await RevealService.startRound(escrow.channelId, 0);
    if (revD.error) return SendReply(message, revD.message, true);
    // mark escrow as started
    RevealStartResponse(
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
    RevealCounterPartyAcceptResponse(
      message,
      { ...escrow, disabled: true },
      true
    );
    RevealFirstResponse(
      client,
      {
        channelId,
      },
      false
    );
    return MessageToChannel(
      message,
      `<@${escrow.counterparty}> Has Declined the Escrow, Add a Second Player`
    );
  }
};

module.exports = {
  createReveal,
  addSecondPlayer,
  addPlayerTOReavel,
  acceptDeclineReveal,
};
