"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    name: { type: String },
    sId: { type: String },
    icon: { type: String },
    ownerId: { type: String },
    onboardChannel: { type: String },
    notificationChannel: { type: String },
    notificationWagerChannel: { type: String },
    notificationRevealChannel: { type: String },
    status: {
      type: String,
      enum: ["active", "removed", "onboarding"],
      default: "onboarding",
    },
  },
  {
    timestamps: true,
  }
);

modelSchema.plugin(uniqueValidator);
const model = mongoose.model("servers", modelSchema);
module.exports = model;
