/* eslint-disable prefer-destructuring */
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
const SystemFee = 20;

const WagerWalletKey = "reveal";
const CURentT = config.TOKEN || "ecox";
const revealPrice = config.TICKET_VALUE;
const totalSelections = (num = 10) =>
  Array(num)
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
  CreateReveal: async (client, serverID, userId, gameNumbers = "10") => {
    const serverId = serverID || config.SERVER_ID;
    const gamePrice = gameNumbers == "10" ? "100" : "500";
    const wagerWallet = await models.Wallet.findOne({ userId: WagerWalletKey });
    if (!wagerWallet) {
      RevealService.createRevealWallet();
      return { error: true, message: "Try Again" };
    }
    // charge userWallet for ticket price
    const userWallet = await models.Wallet.findOne({ userId });
    if (!userWallet)
      return {
        error: true,
        message:
          "Please create a Tender wallet using the /wallet on the Tender Cash bot to get started...",
      };
    const userAcctId =
      CURentT == "eco" ? userWallet.Eco_vId : userWallet.Ecox_vId;
    const wagerAcctId =
      CURentT == "eco" ? wagerWallet.Eco_vId : wagerWallet.Ecox_vId;
    const balance = await getVirtualBalance(userAcctId);
    if (balance < parseFloat(gamePrice))
      return { error: true, message: "Insufficient funds to Create Reveal" };
    // charge user wallet
    const sendValue = await sendFromVirtualToAccount(
      userAcctId,
      wagerAcctId,
      gamePrice,
      0
    );
    if (!sendValue.success)
      return {
        error: true,
        message: sendValue.message || "couldn't pay for reveal ticket",
      };
    // const sendValue = {};

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
      gameNumbers,
      gamePrice,
    });
    await RevealFirstResponse(client, { channelId: createdChannel.id }, false);
    return {
      error: false,
      message: "Reveal Paid...",
      channelName,
      channelId: createdChannel.id,
      gamePrice,
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
    const wagerWallet = await models.Wallet.findOne({ userId: WagerWalletKey });
    if (!wagerWallet) {
      return { error: true, message: "Try Again" };
    }
    // find reveal with channelId
    const reveal = await models.Reveal.findOne({ channelId }).lean();
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    if (reveal.counterparty !== userId)
      return {
        error: true,
        message: `<@${reveal.counterparty}> is required to accept/decline`,
      };
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
    const userWallet = await models.Wallet.findOne({ userId });
    if (!userWallet)
      return { error: true, message: "User needs to create a tender wallet" };
    const userAcctId =
      CURentT == "eco" ? userWallet.Eco_vId : userWallet.Ecox_vId;
    const wagerAcctId =
      CURentT == "eco" ? wagerWallet.Eco_vId : wagerWallet.Ecox_vId;
    const balance = await getVirtualBalance(userAcctId);
    if (balance < parseFloat(reveal.gamePrice))
      return { error: true, message: "Insufficient funds to Create Reveal" };
    // charge user wallet
    const sendValue = await sendFromVirtualToAccount(
      userAcctId,
      wagerAcctId,
      revealPrice,
      0
    );
    if (!sendValue.success)
      return {
        error: true,
        message: sendValue.message || "couldn't pay for reveal channel",
      };
    // const sendValue = {};
    await models.Reveal.updateOne(
      { channelId },
      {
        counterpartyAmount: revealPrice,
        counterpartyPaid: true,
        counterpartyPaymentInfo: JSON.stringify(sendValue),
        status: "started",
      }
    );
    return { error: false, message: "paid successfully", data: reveal };
  },
  startRound: async (channelId, currentRound = 1, isFresh = false) => {
    let roundended = false;
    let allplayed = false;
    let disabledSelections = [];
    // fetch reveal
    const reveal = await models.Reveal.findOne({ channelId }).lean();
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    // create new reveal round
    const revealroundExists = await models.RevealRound.findOne({
      revealId: reveal._id,
      round: currentRound,
    });
    // if (revealroundExists)
    //   return { error: true, message: "Reveal Round Already started" };
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

      disabledSelections = isFresh ? [] : previousround.disabledSelections;
    }
    // const selections = totalSelections;
    const selections = totalSelections(parseFloat(reveal.gameNumbers));
    if (currentRound % 2 == 0) {
      allplayed = true;
    }
    const notSelected = selections.filter(
      (i) => !disabledSelections.includes(i)
    );
    if (notSelected.length < 3) {
      roundended = true;
    }
    // create new round
    const revealRound = await models.RevealRound.create({
      channelId,
      round: currentRound,
      revealId: reveal._id,
      revealer,
      player,
      selections,
      status: "player_select",
      roundended,
      allplayed,
      disabledSelections,
    });
    await models.Reveal.updateOne(
      { channelId },
      {
        selections,
      }
    );
    return {
      error: false,
      message: `(<@${player}> you are the Picker while <@${revealer}> is the Revealer)
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
  playerSelect: async (channelId, currentRound, userId, selection) => {
    // fetch reveal
    const reveal = await models.Reveal.findOne({ channelId }).lean();
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    // find reveal round
    const revealQuery = {
      revealId: reveal._id,
      round: currentRound,
    };
    const revealroundExists = await models.RevealRound.findOne(
      revealQuery
    ).lean();
    if (!revealroundExists)
      return { error: true, message: "Reveal Round Invalid" };
    const IsPlayerTurn = revealroundExists.status == "player_select";
    const IsRevealerTurn = revealroundExists.status == "revealer_select";
    if (IsPlayerTurn && revealroundExists.player !== userId)
      return {
        error: true,
        message: `<@${revealroundExists.player}> is Required to Select`,
      };
    if (IsRevealerTurn && revealroundExists.revealer !== userId)
      return {
        error: true,
        message: `<@${revealroundExists.revealer}> is Required to Select`,
      };
    // update base on userType
    const upData = IsPlayerTurn
      ? {
          playerSelection: selection,
          status: "revealer_select",
        }
      : {
          revealerSelection: selection,
          status: "confirm",
        };
    await models.RevealRound.updateOne(revealQuery, upData);
    if (IsPlayerTurn) {
      return {
        error: false,
        message: `<@${revealroundExists.revealer}> Reveal Selected Number...`,
        data: {
          ...revealroundExists,
          reveal,
        },
      };
    } else {
      let winner = null;
      let won = false,
        isWinner = false;
      nextRound = true;
      let message = "move to next Round";
      let disabledNumbers = revealroundExists.disabledSelections
        ? revealroundExists.disabledSelections
        : [];
      const disabledSelections = [
        ...disabledNumbers,
        revealroundExists.playerSelection,
        selection,
      ];
      let creatorScore = parseFloat(reveal.creatorScore) || 0;
      let counterpartyScore = parseFloat(reveal.counterpartyScore) || 0;

      message = `<@${revealroundExists.revealer}> Pick ${selection} While <@${revealroundExists.player}> Picked ${revealroundExists.playerSelection}\n`;
      if (revealroundExists.playerSelection === selection) {
        if (reveal.creator === revealroundExists.revealer) {
          creatorScore = creatorScore + 1;
        } else {
          counterpartyScore = counterpartyScore + 1;
        }
        // mark revealer as winner for round and selection to reveal disabledNumber
        won = true;
        message = `<@${revealroundExists.revealer}> has Won this Round!!\n`;
      }

      // console.log("exit-->", revealroundExists);
      if (revealroundExists.roundended || revealroundExists.allplayed) {
        nextRound = !revealroundExists.roundended;
        // find final winner
        if (counterpartyScore > creatorScore) winner = reveal.counterparty;
        if (creatorScore > counterpartyScore) winner = reveal.creator;
        if (creatorScore == counterpartyScore && revealroundExists.roundended) {
          winner = "draw";
          message = message + ". \n It's a Draw!!!";
        } else if (
          revealroundExists.allplayed &&
          winner != "draw" &&
          winner != null
        ) {
          message =
            message + `. \n <@${winner}> is the Final Winner of the Reveal!!!`;
          isWinner = true;
        }
      }
      await models.RevealRound.updateOne(revealQuery, {
        revealerSelection: selection,
        disabledSelections,
        won,
        status: "completed",
      });
      await models.Reveal.updateOne(
        { channelId },
        {
          creatorScore,
          counterpartyScore,
          disabledSelections,
          revealWinner: winner,
        }
      );
      return {
        error: false,
        message,
        nextRound,
        won: winner !== "draw",
        roundended: revealroundExists.roundended,
        data: {
          reveal: { ...reveal, creatorScore, counterpartyScore },
          ...revealroundExists,
        },
        winner,
        isWinner,
      };
    }
  },
  claimWins: async (channelId, userId) => {
    const wagerWallet = await models.Wallet.findOne({ userId: WagerWalletKey });
    if (!wagerWallet) {
      return { error: true, message: "Try Again" };
    }
    // find reveal round
    const reveal = await models.Reveal.findOne({ channelId }).lean();
    if (!reveal) return { error: true, message: "Invalid Reveal ID" };
    if (reveal.revealWinner !== userId)
      return {
        error: true,
        message: `Don't be a Criminal!!, <@${reveal.revealWinner}> is the Winner!!`,
      };
    // process withdrawal
    const userWallet = await models.Wallet.findOne({ userId });
    if (!userWallet)
      return { error: true, message: "User needs to create a tender wallet" };
    const userAcctId =
      CURentT == "eco" ? userWallet.Eco_vId : userWallet.Ecox_vId;
    const wagerAcctId =
      CURentT == "eco" ? wagerWallet.Eco_vId : wagerWallet.Ecox_vId;
    const balance = await getVirtualBalance(wagerAcctId);
    if (balance < parseFloat(revealPrice))
      return { error: true, message: "Insufficient funds to Create Reveal" };
    const valueWin = parseFloat(reveal.gamePrice) * 2;
    const amountToClaim = valueWin - (SystemFee / 100) * valueWin;
    const sendValue = await sendFromVirtualToAccount(
      wagerAcctId,
      userAcctId,
      amountToClaim,
      0
    );
    if (!sendValue.success)
      return {
        error: true,
        message: "couldn't pay for send winns",
        systemMessage: sendValue.message || "couldn't pay for send winns",
      };
    // const sendValue = {};
    await models.Reveal.updateOne(
      { _id: reveal._id },
      {
        amountToClaim,
        SystemFee,
        status: "completed",
      }
    );
    return {
      error: false,
      message: "Winnings Sent to Winner",
      data: { ...reveal, amountToClaim },
    };
  },
};

module.exports = RevealService;
