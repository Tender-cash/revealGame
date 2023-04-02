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

  // const msg = new EmbedBuilder()
  //   .setTitle("Reveal Game")
  //   .setDescription("Add Second Player to Continue Game")
  //   .setColor(Colors.Gold);

  const msgPayload = {
    embeds: [],
    components: [msgComponents],
    ephemeral: true,
  };
  return !isUpdated
    ? SendToChannel(client, data.channelId, msgPayload, true)
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
  const guessButtonRow1s = data.selections
    .filter((i) => i < 6)
    .map((n) =>
      buttonComponent(
        JSON.stringify({ id: "select", data: `${String(n)}` }),
        String(n),
        data.disabledSelections.includes(n)
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
        data.disabledSelections.includes(n) || data.disabled
      )
    );
  const guessButtonRow2s = data.selections
    .filter((i) => i > 5 && i < 11)
    .map((n) =>
      buttonComponent(
        JSON.stringify({ id: "select", data: `${String(n)}` }),
        String(n),
        data.disabledSelections.includes(n)
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
        data.disabledSelections.includes(n) || data.disabled
      )
    );
  const guessButtonRow3s = data.selections
    .filter((i) => i > 10 && i < 16)
    .map((n) =>
      buttonComponent(
        JSON.stringify({ id: "select", data: `${String(n)}` }),
        String(n),
        data.disabledSelections.includes(n)
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
        data.disabledSelections.includes(n) || data.disabled
      )
    );
  const guessButtonRow4s = data.selections
    .filter((i) => i > 15 && i < 21)
    .map((n) =>
      buttonComponent(
        JSON.stringify({ id: "select", data: `${String(n)}` }),
        String(n),
        data.disabledSelections.includes(n)
          ? ButtonStyle.Secondary
          : ButtonStyle.Primary,
        data.disabledSelections.includes(n) || data.disabled
      )
    );

  return {
    msgComponents: new ActionRowBuilder().addComponents(guessButtonRow1s),
    msgComponents2: new ActionRowBuilder().addComponents(guessButtonRow2s),
    msgComponents3: new ActionRowBuilder().addComponents(guessButtonRow3s),
    msgComponents4: new ActionRowBuilder().addComponents(guessButtonRow4s),
  };
};

const RevealStartResponse = async (client, data, isUpdated = false) => {
  const { msgComponents, msgComponents2, msgComponents3, msgComponents4 } =
    await fetchComponents(data);

  const msg = new EmbedBuilder()
    .setTitle("Reveal Game: Player One Select")
    .setDescription(`${data.message}`)
    .addFields(
      {
        name: "Player One",
        value: `<@${data.player}> (id ${data.player})`,
        inline: true,
      },
      {
        name: "Player Two",
        value: `<@${data.revealer}> (id ${data.revealer})`,
        inline: true,
      }
    )
    .setColor(Colors.Gold);

  const msgPayload = {
    embeds: [msg],
    components: [msgComponents, msgComponents2, msgComponents3, msgComponents4],
    ephemeral: true,
  };
  return !isUpdated
    ? SendToChannel(client, data.channelId, msgPayload, false)
    : MessageToChannel(client, msgPayload, true);
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
};
