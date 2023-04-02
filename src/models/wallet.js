/* eslint-disable array-bracket-spacing */
"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    userId: { type: String },
    address: { type: String },
    xpub: { type: String },
    // mnemonic: { type: String },
    signatureId: { type: String },
    currentIndex: { type: String },
    currency: { type: String },
    derivationKey: { type: String },
    balance: {
      accountBalance: { type: String },
      availableBalance: { type: String },
    },
    Eco_vId: { type: String },
    Eco_address: { type: String },
    Ecox_vId: { type: String },
    Ecox_address: { type: String },
    frozen: { type: Boolean },
    accountingCurrency: { type: String },
    walletIndex: { type: String },
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
const model = mongoose.model("wallets", modelSchema);
module.exports = model;
