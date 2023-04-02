const mongoose = require("mongoose");
const config = require(".");
const logger = require("../logger");

const mongoUrl = config.MONGO_URL;

// Connect to MongoDB
const IntitateDB = async () => {
  await mongoose.connect(mongoUrl, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });
  logger.info("Database connected");
};
module.exports = IntitateDB;
