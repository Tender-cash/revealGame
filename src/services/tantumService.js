const { TatumEthSDK } = require("@tatumio/eth");
const { sleepSeconds } = require("@tatumio/shared-abstract-sdk");
const config = require("../config");
const logger = require("../logger");
const { makeRequest } = require("../utils/makeRequest");
const models = require("../models");

const SLEEP_SECONDS = 25;
const ethSDK = TatumEthSDK({ apiKey: config.API_KEY });
const baseUrl = "https://api.tatum.io/v3";
const headers = {
  "x-api-key": config.API_KEY,
};

// Get wallet balance for address
const getBalance = async (address) => {
  const { balance } = await ethSDK.blockchain.getBlockchainAccountBalance(
    address
  );
  return balance;
};

// get custome erc20 token balance for address
const getERCBalance = async (token = "eco", address) => {
  const contractAddress =
    token === "eco"
      ? config.CONTRACT_ADDRESS_ECO
      : config.CONTRACT_ADDRESS_ECOX;
  const b = await ethSDK.erc20.getErc20AccountBalance(
    "ETH",
    address,
    contractAddress
  );
  const balance = b.balance / 1e18;
  return balance;
};

// create new wallet on ETH network from tantum
const CreateWallet = async () => {
  const genW = await ethSDK.wallet.generateWallet();
  const address = ethSDK.wallet.generateAddressFromXPub(genW.xpub, 0);
  return { ...genW, address };
};

// get virtual account balance
const getVirtualBalance = async (id) => {
  const balance = await ethSDK.ledger.account.getBalance(id);
  return balance.availableBalance;
};

// create deposit address
const createAddress = async (xpub, i) => {
  const address = ethSDK.wallet.generateAddressFromXPub(xpub, i);
  return address;
};

// create virtual wallet/account
const CreateVirtualWallet = async (address = null, currency = "ETH") => {
  const virtualAccount = await ethSDK.ledger.account.create({
    currency,
  });
  if (address)
    await ethSDK.virtualAccount.depositAddress.assign(
      virtualAccount.id,
      address
    );
  return { ...virtualAccount };
};

// send from virtual account to
const sendFromVirtualToAccount = async (vId, rId, amount, fee = 0) => {
  const Url = baseUrl + "/ledger/transaction";
  const payAmt = parseFloat(amount) + parseFloat(fee);
  const payData = {
    senderAccountId: vId,
    recipientAccountId: rId,
    amount: String(payAmt),
  };
  const result = await makeRequest(Url, "POST", payData, headers);
  return result;
};

// send custom token from wallet
const SendERC20 = async (
  token,
  receiverAddress,
  amount,
  signatureId,
  index = 0
) => {
  const contractAddress =
    token === "eco"
      ? config.CONTRACT_ADDRESS_ECO
      : config.CONTRACT_ADDRESS_ECOX;
  const digits = config.CONTRACT_DIGIT;
  const erc20Transferred = await ethSDK.erc20.send.transferSignedTransaction({
    to: receiverAddress,
    amount: String(amount),
    contractAddress,
    signatureId,
    digits: parseInt(digits),
    index: index,
  });

  logger.info(`Erc20 transaction with txID ${erc20Transferred.txId} was sent.`);
  logger.info(
    `Waiting ${SLEEP_SECONDS} seconds for the transaction [${erc20Transferred.txId}] to appear in a block`
  );
  // await sleepSeconds(SLEEP_SECONDS);
  // console.log("txer-->", erc20Transferred);
  return erc20Transferred.signatureId;
};

// create Virtual Currency
const CreateVirtualCurrency = async (tokenName, tokenAddress, totalSupply) => {
  // check db for currency
  const currency = await models.Currency.findOne({
    currency: tokenName,
    address: tokenAddress,
  });
  if (!currency) {
    // check for existing currency
    const exCur = await FindCurrency(tokenName);
    if (exCur.success) {
      const virtualData = exCur.data;
      // save currency to database;
      const vCurrencyD = {
        currency: virtualData.name,
        vId: virtualData.accountId,
        address: tokenAddress,
        data: JSON.stringify(virtualData),
      };
      // freeze virtualCurrencyAccount
      // await FreezeAccount(virtualData.accountId);
      // add token Address to virtual currency
      await ConnectExToken(virtualData.name, tokenAddress);
      await models.Currency.create(vCurrencyD);
      return;
    }
    const Url = baseUrl + "/ledger/virtualCurrency";
    const payload = {
      name: tokenName,
      supply: totalSupply,
      description: tokenName + " Token",
      basePair: "USDC",
      decimals: 18,
      // address: tokenAddress,
    };
    const response = await makeRequest(
      Url,
      "POST",
      payload,
      headers,
      null,
      false
    );
    if (response.success) {
      const virtualData = response.data;
      // save currency to database;
      const vCurrencyD = {
        currency: virtualData.currency,
        vId: virtualData.accountId,
        address: tokenAddress,
        data: JSON.stringify(virtualData),
      };
      // freeze virtualCurrencyAccount
      await FreezeAccount(virtualData.accountId);
      // add token Address to virtual currency
      await ConnectExToken(virtualData.name, tokenAddress);
      await models.Currency.create(vCurrencyD);
    }
  }
};

// find virtual currency
const FindCurrency = async (tokenName) => {
  const Url = baseUrl + "/ledger/virtualCurrency/" + tokenName;
  const response = await makeRequest(Url, "GET", {}, headers);
  return response;
};

// freezeAccount
const FreezeAccount = async (accountID) => {
  const Url = baseUrl + "/ledger/account/" + accountID + "/freeze";
  const response = await makeRequest(Url, "PUT", {}, headers);
  return response;
};

const ConnectExToken = async (VToken, tokenAddress) => {
  const Url = baseUrl + "/offchain/token/" + VToken + "/" + tokenAddress;
  const response = await makeRequest(Url, "PUT", {}, headers);
  return response;
};

// perform external withdrawal from admin wallet
const ExternalWithdrawal = async (
  senderAccountId,
  recipient,
  amount,
  fee,
  token = "eco"
) => {
  let completed = false;
  let msg, resData;
  const withdrawAmount = parseFloat(amount) + parseFloat(fee);
  // initiate virtual withdrawal
  const withTx = await WithdrawalVirtual(
    senderAccountId,
    recipient,
    String(withdrawAmount)
  );
  if (withTx.success) {
    const txId = withTx.data.id;
    // get admin wallet and privateKey
    const adminWallet = await models.Wallet.findOne({
      userId: "system",
    }).lean();
    if (!adminWallet) {
      completed = false;
      msg = "Admin Wallet not Present!!!";
      resData = {};
    } else {
      const cusTx = await SendERC20(
        token,
        recipient,
        amount,
        adminWallet.signatureId
      );
      completed = !!cusTx;
      msg = cusTx;
      resData = cusTx;
    }
    // update virtual withdrawal
    await MarkVirtualTx(txId, completed);
    return { success: completed, msg, data: resData };
  } else {
    let msg = withTx.data.message;
    if (withTx.data.errorCode === "balance.insufficient") {
      msg = "Insufficent balance to proceed";
    }
    return { success: false, msg, data: withTx.data };
  }
};

// perform offchain withdrawal
const WithdrawalVirtual = async (
  senderAccountId,
  address,
  amount,
  fee = "0.0005"
) => {
  const Url = baseUrl + "/offchain/withdrawal";
  const payload = {
    senderAccountId,
    address,
    amount,
    fee,
  };
  const response = await makeRequest(Url, "POST", payload, headers);
  return response;
};

// perform erc20 withdrawal for admin wallet
const CustodialTransfer = async (
  signatureId,
  chain = "ETH",
  custodialAddress,
  recipient,
  tokenAddress,
  amount
) => {
  const Url = baseUrl + "/blockchain/sc/custodial/transfer";
  const payload = {
    chain,
    custodialAddress,
    recipient,
    contractType: 0,
    tokenAddress,
    amount,
    // fromPrivateKey,
    signatureId,
  };
  const response = await makeRequest(Url, "POST", payload, headers);
  return response;
};

// update virtual withdrawal status
const MarkVirtualTx = async (txId, complete = false) => {
  const method = complete ? "PUT" : "DELETE";
  const Url = baseUrl + "/offchain/withdrawal/" + txId;
  const response = await makeRequest(Url, method, {}, headers);
  return response;
};

// perform external withdrawal from admin wallet
const VCMINt = async (
  senderAccountId,
  recipient,
  amount,
  fee,
  token = "eco"
) => {
  let completed = false;
  let msg, resData;
  const withdrawAmount = parseFloat(amount) + parseFloat(fee);
  // initiate virtual withdrawal
  const withTx = await WithdrawalVirtual(
    senderAccountId,
    recipient,
    String(withdrawAmount)
  );
  if (withTx.success) {
    const txId = withTx.data.id;
    // get admin wallet and privateKey
    const adminWallet = await models.Wallet.findOne({
      userId: "system",
    }).lean();
    if (!adminWallet) {
      completed = false;
      msg = "Admin Wallet not Present!!!";
      resData = {};
    } else {
      // const fromPrivateKey = await ethSDK.wallet.generatePrivateKeyFromMnemonic(adminWallet.mnemonic);
      // const tokenAddress =
      //   token == "eco"
      //     ? config.CURRENCY.ECO.TOKEN_ADDRESS
      //     : config.CURRENCY.ECOX.TOKEN_ADDRESS;
      // perform custodial withdrawal
      // const cusTx = await CustodialTransfer(
      //   fromPrivateKey,
      //   "ETH",
      //   adminWallet.address,
      //   recipient,
      //   tokenAddress,
      //   amount
      // );
      const cusTx = await SendERC20(
        token,
        recipient,
        amount,
        adminWallet.signatureId
      );
      completed = !!cusTx;
      msg = cusTx;
      resData = cusTx;
    }
    // update virtual withdrawal
    await MarkVirtualTx(txId, completed);
    return { success: completed, msg, data: resData };
  } else {
    let msg = withTx.data.message;
    if (withTx.data.errorCode === "balance.insufficient") {
      msg = "Insufficent balance to proceed";
    }
    return { success: false, msg, data: withTx.data };
  }
};

// fetch transaction data
// https://api.tatum.io/v3/kms/
const FetchKMSTxData = async (txId) => {
  const method = "GET";
  const Url = baseUrl + "/kms/" + txId;
  const response = await makeRequest(Url, method, {}, headers);
  return response;
};
module.exports = {
  getBalance,
  getERCBalance,
  CreateWallet,
  getVirtualBalance,
  CreateVirtualWallet,
  sendFromVirtualToAccount,
  SendERC20,
  CreateVirtualCurrency,
  FindCurrency,
  FreezeAccount,
  ConnectExToken,
  ExternalWithdrawal,
  WithdrawalVirtual,
  CustodialTransfer,
  MarkVirtualTx,
  createAddress,
  FetchKMSTxData,
};
