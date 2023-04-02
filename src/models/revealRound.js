"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    channelId: { type: String },
    revealId: { type: String },
    revealer: { type: String },
    player: { type: String },
    round: { type: String },
    playerSelection: { type: String },
    revealerSelection: { type: String },
    selections: { type: Array },
    won: { type: Boolean },
    roundended: { type: Boolean },
    disabledSelections: { type: Array },
    status: {
      type: String,
      enum: ["player_select", "revealer_select", "completed"],
      default: "player_select",
    },
  },
  {
    timestamps: true,
  }
);

modelSchema.plugin(uniqueValidator);
const model = mongoose.model("reveal_game_rounds", modelSchema);
module.exports = model;
