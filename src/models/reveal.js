"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    channelId: { type: String },
    channelName: { type: String },
    creator: { type: String },
    counterparty: { type: String },
    creatorPaid: { type: Boolean },
    counterpartyPaid: { type: Boolean },
    counterpartyAccept: { type: Boolean },
    creatorPaymentInfo: { type: String },
    counterpartyPaymentInfo: { type: String },
    currentRound: { type: String },
    totalRounds: { type: String },
    creatorScore: { type: String },
    counterpartyScore: { type: String },
    selections: { type: Array },
    disabledSelections: { type: Array },
    revealWinner: { type: String },
    serverId: { type: String },
    gameNumbers: { type: String },
    gamePrice: { type: String },
    amountToClaim: { type: String },
    status: {
      type: String,
      enum: ["waiting", "counterparty", "ongoing", "ended", "completed"],
      default: "waiting",
    },
  },
  {
    timestamps: true,
  }
);

modelSchema.plugin(uniqueValidator);
const model = mongoose.model("reveal_game", modelSchema);
module.exports = model;
