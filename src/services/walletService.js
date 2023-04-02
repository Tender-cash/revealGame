const config = require("../config");
const models = require("../models");
const TantumService = require("./tantumService");

const CreateWallet = async (userId) => {
  const existWallet = await await models.Wallet.findOne({ userId });
  if (existWallet) return { error: true, message: "Wallet exists" };
  const systemWallet = await models.Wallet.findOne({ userId: "system" });
  if (!systemWallet)
    return { error: true, message: "System Wallet not existing..." };
  const currentIndex = parseInt(systemWallet.currentIndex || 0) + 1;
  const walletAddress = await TantumService.createAddress(
    systemWallet.xpub,
    currentIndex
  );
  const virtualWallet1 = await TantumService.CreateVirtualWallet(
    walletAddress,
    config.CURRENCY.ECO.NAME
  );
  const virtualWallet2 = await TantumService.CreateVirtualWallet(
    walletAddress,
    config.CURRENCY.ECOX.NAME
  );

  const walletData = {
    userId,
    xpub: systemWallet.xpub,
    address: walletAddress,
    signatureId: systemWallet.signatureId,
    Eco_vId: virtualWallet1.id,
    Eco_address: walletAddress,
    Ecox_vId: virtualWallet2.id,
    Ecox_address: walletAddress,
    walletIndex: currentIndex,
  };

  await models.Wallet.create(walletData);
  await models.User.updateOne(
    { uId: userId },
    {
      walletGenerated: true,
    }
  );
  await models.Wallet.updateOne(
    { userId: "system" },
    {
      currentIndex,
    }
  );
  return walletData;
};

module.exports = {
  CreateWallet,
};
