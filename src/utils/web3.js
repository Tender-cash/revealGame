const { ethers } = require("ethers");
const {
  ChainlinkProvider,
  RandomNumberConsumer,
} = require("@chainlink/contracts/ethers/v0.8");

const provider = new ethers.providers.JsonRpcProvider(); // set your Ethereum JSON-RPC provider
const chainlinkProvider = new ChainlinkProvider(provider);
const randomNumberConsumerAddress =
  "0x0000000000000000000000000000000000000000"; // set the address of the deployed RandomNumberConsumer contract

const getRandomNumber = async () => {
  const randomNumberConsumer = new RandomNumberConsumer(
    randomNumberConsumerAddress,
    chainlinkProvider
  );
  const randomResult = await randomNumberConsumer.getRandomNumber();
  const randomInt = (parseInt(randomResult.toString(), 10) % 300) + 1;
  console.log(randomInt);
};

getRandomNumber();
