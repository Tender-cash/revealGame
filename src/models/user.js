"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    username: { type: String },
    uId: { type: String },
    avatar: { type: String },
    discriminator: { type: String },
    walletGenerated: { type: Boolean },
    isAdmin: { type: Boolean, default: false },
    pin: { type: String },
    status: {
      type: String,
      enum: ["pending", "completed", "disabled"],
      default: "pending",
    },
  },
  {
    timestamps: true,
  }
);

modelSchema.plugin(uniqueValidator);
const model = mongoose.model("users", modelSchema);
module.exports = model;
