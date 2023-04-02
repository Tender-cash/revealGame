const app = require("./app");
const Logger = require("./logger");

// start bot
// CronStart();
app();

process.on("uncaughtException", (err) => {
  Logger.warn("Uncaught Exception!! Shutting down process..");
  Logger.error(err.stack);
  // send alerts for system error/termination
  process.exit(1);
});

process.on("unhandledRejection", (err) => {
  Logger.warn("Unhandled Rejection!!" + err);
  console.log(err);
  // send alerts for system error/termination
  process.exit(1);
});

process.on("SIGINT", () => {
  Logger.info(
    "Received SIGINT. Terminating Server. \n Press Control-D to exit."
  );
  process.exit();
});
