/* eslint-disable array-bracket-spacing */
"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    userId: { type: String },
    ticketId: { type: String },
    winner: { type: Boolean, default: false },
    winAmount: { type: String },
    paid: { type: Boolean, default: false },
    amount: { type: String },
    status: {
      type: String,
      enum: ["active", "disabled"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

modelSchema.plugin(uniqueValidator);
const model = mongoose.model("tickets", modelSchema);
module.exports = model;
