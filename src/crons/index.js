const Logger = require("../logger");
const cron = require("node-cron");

const CronStart = (client) => {
  Logger.info("Cron Job Online....");
  let ProcessTicketSelection;
  try {
    // ProcessTicketSelection = cron.schedule("0 0 * * *", async () => {
    //   Logger.info("CRON::: Processing Ticket selection----");
    //   return WagerService.ReleaseWager(client);
    // });
    Logger.info("Cron Job Started....");
    // ProcessTicketSelection.start();
    return cron;
  } catch (error) {
    // ProcessTicketSelection.stop();
    Logger.error(error);
  }
};

const CronStop = () => {
  try {
    Logger.info("Cron Job Stopping....");
    // ProcessTicketSelection.stop();
    return cron;
  } catch (error) {
    Logger.error(error);
  }
};

module.exports = {
  CronStart,
  CronStop,
};
