"use strict";

const mongoose = require("mongoose");
const uniqueValidator = require("mongoose-unique-validator");

const { Schema } = mongoose;

const modelSchema = new Schema(
  {
    type: { type: String },
    xpub: { type: String },
    signatureId: { type: String },
    currentIndex: { type: String },
    generatedAddress: { type: String },
  },
  {
    timestamps: true,
  }
);

modelSchema.plugin(uniqueValidator);
const model = mongoose.model("settings", modelSchema);
module.exports = model;
