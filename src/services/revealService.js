const config = require("../config");
const Logger = require("../logger");
const models = require("../models");
const { randomString, randomIntFromInterval } = require("../utils");
const {
  getERCBalance,
  SendERC20,
  sendFromVirtualToAccount,
  getVirtualBalance,
} = require("./tantumService");
const { CreateWallet } = require("./walletService");
const dayjs = require("dayjs");
const utc = require("dayjs/plugin/utc");
const duration = require("dayjs/plugin/duration");
const {
  NotifyChannel,
  SendNotify,
  RevealFirstResponse,
} = require("../bot/responses");
const { ChannelType, PermissionFlagsBits } = require("discord.js");
dayjs.extend(utc);
dayjs.extend(duration);

const TAG = "RevealService";

const WagerWalletKey = "reveal";
const CURentT = "ecox";
const revealPrice = config.TICKET_VALUE;
const totalSelections = Array(20)
  .join()
  .split(",")
  .map(
    function (a) {
      return this.i++;
    },
    { i: 1 }
  );

const RevealService = {
  createRevealWallet: async () => {
    try {
      // check for reveal wallet
      const wagerWallet = await models.Wallet.findOne({
        userId: WagerWalletKey,
      });
      if (wagerWallet) return;
      // create reveal wallet
      const p = await CreateWallet(WagerWalletKey);
    } catch (error) {
      Logger.error(`${TAG}::createWagerWallet -- ${error}`);
    }
  },
  createPrivateChannel: async (client, serverId, channelName, creator) => {
    const guild = await client.guilds.fetch(serverId);
    const everyoneRole = guild.roles.everyone;
    const channel = await guild.channels.create({
      name: channelName,
      type: ChannelType.GuildText,
      permissionOverwrites: [
        {
          type: "member",
          id: creator,
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
    return channel;
  },
  CreateReveal: async (client, serverID, userId) => {
    const serverId = serverID || config.SERVER_ID;
    const wagerWallet = await models.Wallet.findOne({ userId: WagerWalletKey });
    if (!wagerWallet) {
      RevealService.createRevealWallet();
      return { error: true, message: "Try Again" };
    }
    // charge userWallet for ticket price
    // const userWallet = await models.Wallet.findOne({ userId });
    // if (!userWallet)
    //   return { error: true, message: "User needs to create a tender wallet" };
    // const userAcctId =
    //   CURentT == "eco" ? userWallet.Eco_vId : userWallet.Ecox_vId;
    // const wagerAcctId =
    //   CURentT == "eco" ? wagerWallet.Eco_vId : wagerWallet.Ecox_vId;
    // const balance = await getVirtualBalance(userAcctId);
    // if (balance < parseFloat(revealPrice))
    //   return { error: true, message: "Insufficient funds to Create Reveal" };
    // // charge user wallet
    // const sendValue = await sendFromVirtualToAccount(
    //   userAcctId,
    //   wagerAcctId,
    //   revealPrice,
    //   0
    // );
    // if (!sendValue.success)
    //   return {
    //     error: true,
    //     message: sendValue.message || "couldn't pay for reveal ticket",
    //   };
    const sendValue = {};

    const channelName = "reveal_" + randomString(5);
    const createdChannel = await RevealService.createPrivateChannel(
      client,
      serverId,
      channelName,
      userId
    );
    // save reveal model
    await models.Reveal.create({
      creator: userId,
      creatorPaid: true,
      creatorPaymentInfo: JSON.stringify(sendValue),
      channelName,
      channelId: createdChannel.id,
      serverId,
    });
    RevealFirstResponse(client, { channelId: createdChannel.id }, false);
    return {
      error: false,
      message: "Reveal Paid...",
      channelName,
      channelId: createdChannel.id,
    };
  },
  addCounterParty: async (userId, channelId) => {
    // find reveal with channelId
    const reveal = await models.Reveal.findOne({ channelId });
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    // update reveal with counterparty
    await models.Reveal.updateOne(
      { channelId },
      {
        counterparty: userId,
      }
    );
    return { error: false, message: "counterparty added" };
  },
  CounterPartyPay: async (userId, channelId, isAccepted = false) => {
    // find reveal with channelId
    const reveal = await models.Reveal.findOne({ channelId });
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    // if (reveal.counterparty !== userId)
    //   return {
    //     error: true,
    //     message: `<@${reveal.counterparty}> is required to accept/decline`,
    //   };
    if (!isAccepted) {
      // remove counterparty and update db
      await models.Reveal.updateOne(
        { channelId },
        {
          counterparty: "",
          status: "waiting",
        }
      );
      return { error: false, message: "CounterParty declined", data: reveal };
    }
    // charge userWallet for ticket price
    // const userWallet = await models.Wallet.findOne({ userId });
    // if (!userWallet)
    //   return { error: true, message: "User needs to create a tender wallet" };
    // const userAcctId =
    //   CURentT == "eco" ? userWallet.Eco_vId : userWallet.Ecox_vId;
    // const wagerAcctId =
    //   CURentT == "eco" ? wagerWallet.Eco_vId : wagerWallet.Ecox_vId;
    // const balance = await getVirtualBalance(userAcctId);
    // if (balance < parseFloat(revealPrice))
    //   return { error: true, message: "Insufficient funds to Create Reveal" };
    // // charge user wallet
    // const sendValue = await sendFromVirtualToAccount(
    //   userAcctId,
    //   wagerAcctId,
    //   revealPrice,
    //   0
    // );
    // if (!sendValue.success)
    //   return {
    //     error: true,
    //     message: sendValue.message || "couldn't pay for reveal channel",
    //   };
    const sendValue = {};
    await models.Reveal.updateOne(
      { channelId },
      {
        counterpartyPaid: true,
        counterpartyPaymentInfo: JSON.stringify(sendValue),
        status: "started",
      }
    );
    return { error: false, message: "paid successfully", data: reveal };
  },
  startRound: async (channelId, currentRound = 1) => {
    // fetch reveal
    const reveal = await models.Reveal.findOne({ channelId });
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    const disabledSelections = reveal.disabledSelections
      ? reveal.disabledSelections
      : [];
    // create new reveal round
    const revealroundExists = await models.RevealRound.findOne({
      revealId: reveal._id,
      round: currentRound,
    });
    if (revealroundExists)
      return { error: true, message: "Reveal Round Already started" };
    let revealer = reveal.creator;
    let player = reveal.counterparty;
    // create new reveal round
    const previousround = await models.RevealRound.findOne({
      revealId: reveal._id,
      round: parseFloat(currentRound) - 1,
    });
    if (previousround) {
      revealer =
        previousround.revealer === reveal.counterparty
          ? reveal.creator
          : reveal.counterparty;
      player =
        previousround.player === reveal.counterparty
          ? reveal.creator
          : reveal.counterparty;
    }
    const selections = totalSelections;
    // .filter(
    //   (i) => !disabledSelections.includes(i)
    // );
    // console.log("selections---", selections);
    // create new round
    const revealRound = await models.RevealRound.create({
      channelId,
      round: currentRound,
      revealId: reveal._id,
      revealer,
      player,
      selections,
      status: "player_select",
    });
    await models.Reveal.updateOne(
      { channelId },
      {
        selections,
      }
    );
    return {
      error: false,
      message: `(<@${player}> you are player 1 while <@${revealer}> is the revealer)
    `,
      data: {
        selections,
        player,
        revealer,
        channelId,
        revealId: reveal._id,
        round: currentRound,
        disabledSelections,
      },
    };
  },
  playerSelect: async (
    channelId,
    currentRound,
    userId,
    userType,
    selection
  ) => {
    // fetch reveal
    const reveal = await models.Reveal.findOne({ channelId });
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    // find reveal round
    const revealQuery = {
      revealId: reveal._id,
      round: currentRound,
    };
    const revealroundExists = await models.RevealRound.findOne(revealQuery);
    if (!revealroundExists)
      return { error: true, message: "Reveal Round Invalid" };
    if (userType === "player" && revealroundExists.player !== userId)
      return {
        error: true,
        message: `<@${revealroundExists.player}> is Required to Select`,
      };
    if (userType === "revealer" && revealroundExists.revealer !== userId)
      return {
        error: true,
        message: `<@${revealroundExists.revealer}> is Required to Select`,
      };
    // update base on userType
    const upData =
      userType === "player"
        ? {
            playerSelection: selection,
            status: "revealer_select",
          }
        : {
            revealerSelection: selection,
            status: "confirm",
          };
    await models.RevealRound.updateOne(revealQuery, upData);
    if (isPlayer) {
      return {
        error: false,
        message: `<@${revealroundExists.revealer}> Reveal Selected Number...`,
      };
    } else {
      if (revealroundExists.playerSelection === selection) {
        let creatorScore = parseFloat(reveal.creatorScore) || 0;
        let counterpartyScore = parseFloat(reveal.counterpartyScore) || 0;
        let disabledNumbers = reveal.disabledSelections
          ? JSON.parse(reveal.disabledSelections)
          : [];
        if (reveal.creator === revealroundExists.revealer) {
          creatorScore = creatorScore + 1;
        } else {
          counterpartyScore = counterpartyScore + 1;
        }
        // mark revealer as winner for round and selection to reveal disabledNumber
        await models.RevealRound.updateOne(revealQuery, {
          revealerSelection: selection,
          won: true,
          status: "completed",
        });
        await models.Reveal.updateOne(
          { channelId },
          {
            creatorScore,
            counterpartyScore,
            disabledSelections: JSON.stringify([
              ...disabledNumbers,
              revealroundExists.playerSelection,
              selection,
            ]),
          }
        );
      } else {
        // mark none
      }
    }
    return { error: false, message: "move to the next round" };
  },
};

module.exports = RevealService;
