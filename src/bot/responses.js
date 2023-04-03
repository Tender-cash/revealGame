/* eslint-disable array-bracket-spacing */
const {
  ActionRowBuilder,
  ButtonBuilder,
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ButtonStyle,
  Colors,
  SelectMenuBuilder,
} = require("discord.js");
const config = require("../config");
const models = require("../models");
const Logger = require("../logger");

// custom button component
const buttonComponent = (
  id,
  title,
  style = ButtonStyle.Primary,
  disabled = false
) => {
  return new ButtonBuilder()
    .setCustomId(id)
    .setLabel(title)
    .setStyle(style)
    .setDisabled(disabled);
};
const perChunk = 5;

// Defer Interaction Response
const SendDefer = async (interaction, content = "Loading....") =>
  interaction.reply({ content, ephemeral: true });

// Send Interaction Reply
const SendReply = async (interaction, data, ephemeral = true) =>
  SendFollowUp(interaction, data, false, ephemeral);

// Send Interaction FollowUp
const SendFollowUp = async (
  interaction,
  data,
  isComponent = false,
  ephemeral = true,
  isUpdated = false
) => {
  const d = isComponent ? data : { content: data, ephemeral };
  // console.log("fgh-->", interaction.deferred, interaction.replied, isUpdated);
  return interaction.deferred || interaction.replied
    ? isUpdated
      ? interaction.editReply(d)
      : interaction.followUp(d)
    : isUpdated
    ? interaction.update(d)
    : interaction.reply(d);
};

const SendToChannel = async (client, channelId, data, pined = false) => {
  let msg;
  const chn = await client.channels.cache.get(channelId);
  if (chn) {
    msg = await chn.send(data);
  } else {
    await client.channels.fetch(channelId);
    msg = await client.channels.cache.get(channelId).send(data);
  }
  if (pined) {
    msg.pin();
  }
  return;
};

const MessageToChannel = async (message, data, updated = false) =>
  updated ? message.update(data) : message.channel.send(data);

// Send Notification to Transaction Channel
const NotifyChannel = async (client, interaction, message) => {
  const channelNotID = config.TX_CHANNEL_ID;
  const chn = await client.channels.cache.get(channelNotID);
  if (chn) {
    chn.send(message);
  } else {
    await client.channels.fetch(channelNotID);
    await client.channels.cache.get(channelNotID).send(message);
  }
  return;
};
// send Winning Notifications
const SendNotify = (client, data) => {
  const description = data.message || "Ticket Selection/Winner";
  const msg = new EmbedBuilder()
    .setTitle("Ticket Selection/Winner")
    .setDescription(description)
    .addFields(
      {
        name: "Start",
        value: `${data.start}`,
        inline: true,
      },
      {
        name: "End",
        value: `${data.end}`,
        inline: true,
      },
      {
        name: "Winner",
        value: `${data.winner}`,
        inline: true,
      },
      {
        name: "Amount",
        value: `${data.amount} ${data.token}`,
        inline: true,
      }
    )
    .setColor(Colors.Gold);

  const msgPayload = {
    embeds: [msg],
    components: [],
    ephemeral: false,
  };
  return NotifyChannel(client, "", msgPayload);
};

const RevealFirstResponse = async (client, data, isUpdated = false) => {
  const msgComponents = new ActionRowBuilder().addComponents(
    buttonComponent(
      JSON.stringify({ id: "add-player" }),
      "Add Second Player",
      ButtonStyle.Primary,
      data.disabled
    )
  );

  const msg = new EmbedBuilder()
    .setTitle("Reveal Game")
    .setDescription(
      "In the game of Reveal, two players each have a set of buttons numbered 1-20. The game starts with Player 1 selecting a number. The system then hides the buttons and asks Player 2 to guess the number that Player 1 chose.\n\nIf Player 2 guesses correctly, the game ends and the pot of funds is awarded to Player 2. However, if Player 2 guesses incorrectly, the system reveals both numbers selected by the players and disables those buttons. Then, it's Player 2's turn to select a number first and the game continues in the same way."
    )
    .setColor(Colors.Gold);

  const msgPayload = {
    embeds: [msg],
    components: [msgComponents],
    ephemeral: true,
  };
  return !isUpdated
    ? SendToChannel(client, data.channelId, msgPayload, false)
    : MessageToChannel(client, msgPayload, true);
};

const AdduserNameModalResponse = async (interaction) => {
  const modal = new ModalBuilder()
    .setCustomId(JSON.stringify({ id: "add-counterparty" }))
    .setTitle("Add CounterParty!");
  const titleInput = new TextInputBuilder()
    .setCustomId("username")
    .setLabel("Enter Discord Username")
    .setStyle(TextInputStyle.Short)
    .setRequired(true);

  const secondActionRow = new ActionRowBuilder().addComponents(titleInput);
  modal.addComponents(secondActionRow);
  return interaction.showModal(modal);
};

const RevealCounterPartyAcceptResponse = async (
  client,
  data,
  isUpdated = false
) => {
  const msgComponents = new ActionRowBuilder().addComponents(
    buttonComponent(
      JSON.stringify({ id: "accept-request" }),
      "Accept",
      ButtonStyle.Success,
      data.disabled
    ),
    buttonComponent(
      JSON.stringify({ id: "decline-request" }),
      "Decline",
      ButtonStyle.Danger,
      data.disabled
    )
  );

  const msg = new EmbedBuilder()
    .setTitle("Reveal Game: Request")
    .setDescription(`<@${data.counterparty}> Accept/decline request...`)
    .addFields(
      {
        name: "Player One",
        value: `<@${data.creator}> (id ${data.creator})`,
        inline: true,
      },
      {
        name: "Player Two",
        value: `<@${data.counterparty}> (id ${data.counterparty})`,
        inline: true,
      }
    )
    .setColor(Colors.Gold);

  const msgPayload = {
    embeds: [msg],
    components: [msgComponents],
    ephemeral: true,
  };
  return !isUpdated
    ? SendToChannel(client, data.channelId, msgPayload, false)
    : MessageToChannel(client, msgPayload, true);
};

const fetchComponents = (data) => {
  const components = [];
  const result = data.selections.reduce((resultArray, item, index) => {
    const chunkIndex = Math.floor(index / perChunk);

    if (!resultArray[chunkIndex]) {
      resultArray[chunkIndex] = []; // start a new chunk
    }

    resultArray[chunkIndex].push(item);

    return resultArray;
  }, []);
  for (let i = 0; i < result.length; i++) {
    const element = result[i];
    const guessButtonRow = element.map((n) =>
      buttonComponent(
        JSON.stringify({
          id: "select",
          data: { selection: `${String(n)}`, round: data.round },
        }),
        String(n),
        data.disabledSelections.includes(n)
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
        data.disabledSelections.includes(n) || data.disabled
      )
    );
    components.push(new ActionRowBuilder().addComponents(guessButtonRow));
  }
  return components;
};

const RevealStartResponse = async (client, data, isUpdated = false) => {
  const msgcomponents = await fetchComponents(data);

  const msg = new EmbedBuilder()
    .setTitle("Reveal Game: Player One Select")
    .setDescription(`${data.message}`)
    .addFields(
      {
        name: "Picker",
        value: `<@${data.player}> (id ${data.player})`,
        inline: true,
      },
      {
        name: "Revealer",
        value: `<@${data.revealer}> (id ${data.revealer})`,
        inline: true,
      }
    )
    .setColor(Colors.Gold);
  const msgPayload = {
    embeds: [msg],
    components: [...msgcomponents],
    ephemeral: true,
  };
  return !isUpdated
    ? SendToChannel(client, data.channelId, msgPayload, false)
    : MessageToChannel(client, msgPayload, true);
};

const RevealWithdrawResponse = async (client, data, isUpdated = false) => {
  const btnTitle = data.iswin ? "Withdraw" : "Next Round";
  const description = data.message;
  const btnData = data.iswin
    ? { id: "claim-win", data: { round: data.round } }
    : { id: "next-round", data: { round: data.round } };
  const btnStyle = data.iswin ? ButtonStyle.Success : ButtonStyle.Danger;
  const msgComponents = new ActionRowBuilder().addComponents(
    buttonComponent(JSON.stringify(btnData), btnTitle, btnStyle, data.disabled)
  );

  const msg = new EmbedBuilder()
    .setTitle(`Reveal Game: ${btnTitle}`)
    .setDescription(`${description}`)
    .addFields(
      {
        name: "Picker",
        value: `<@${data.player}> (id ${data.player}) ${
          data.winner == data.player ? "(winner)" : ""
        }`,
        inline: true,
      },
      {
        name: "Revealer",
        value: `<@${data.revealer}> (id ${data.revealer}) ${
          data.winner == data.revealer ? "(winner)" : ""
        }`,
        inline: true,
      },
      {
        name: "-----------------------------------------------------------------------------------",
        value:
          "-----------------------------------------------------------------------------------",
        inline: false,
      }
    )
    .setColor(Colors.Gold);
  if (data.reveal) {
    const revD = data.reveal;
    msg.addFields(
      {
        name: "Picker's Score",
        value: `${
          revD.creator == data.player
            ? String(revD.creatorScore)
            : String(revD.counterpartyScore)
        }`,
        inline: true,
      },
      {
        name: "Revealer's Score",
        value: `${
          revD.creator == data.revealer
            ? String(revD.creatorScore)
            : String(revD.counterpartyScore)
        }`,
        inline: true,
      }
    );
  }

  const msgPayload = {
    embeds: [msg],
    components: [msgComponents],
    ephemeral: true,
  };
  return !isUpdated
    ? SendToChannel(client, data.channelId, msgPayload, false)
    : MessageToChannel(client, msgPayload, true);
};

const ChooseGameTypeResponse = async (
  client,
  data,
  isUpdated = false,
  inter = false
) => {
  const msgComponents = new ActionRowBuilder().addComponents(
    buttonComponent(
      JSON.stringify({ id: "game-type", data: { type: "10" } }),
      "Game of 10",
      ButtonStyle.Primary,
      data.disabled
    ),
    buttonComponent(
      JSON.stringify({ id: "game-type", data: { type: "20" } }),
      "Game of 20",
      ButtonStyle.Primary,
      data.disabled
    )
  );

  const msg = new EmbedBuilder()
    .setTitle("Reveal Game: Select Game Type")
    .setDescription("Select Game Type to proceed...")
    .addFields(
      {
        name: "Game Type 10",
        value: `100 ${config.TOKEN}`,
        inline: true,
      },
      {
        name: "Game Type 20",
        value: `500 ${config.TOKEN}`,
        inline: true,
      }
    )
    .setColor(Colors.Gold);

  const msgPayload = {
    embeds: [msg],
    components: [msgComponents],
    ephemeral: true,
  };
  return !isUpdated && !inter
    ? SendToChannel(client, data.channelId, msgPayload, false)
    : MessageToChannel(client, msgPayload, isUpdated);
};

module.exports = {
  SendDefer,
  SendReply,
  SendFollowUp,
  RevealFirstResponse,
  NotifyChannel,
  SendNotify,
  AdduserNameModalResponse,
  MessageToChannel,
  RevealCounterPartyAcceptResponse,
  RevealStartResponse,
  RevealWithdrawResponse,
  ChooseGameTypeResponse,
};
