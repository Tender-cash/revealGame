/* eslint-disable array-bracket-spacing */
"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    userId: { type: String },
    ticketId: { type: String },
    winAmount: { type: String },
    paid: { type: Boolean, default: false },
    totalTickets: { type: String },
    startDate: { type: String },
    endDate: { type: String },
    token: { type: String },
  },
  {
    timestamps: true,
  }
);

modelSchema.plugin(uniqueValidator);
const model = mongoose.model("tickets_wins", modelSchema);
module.exports = model;
