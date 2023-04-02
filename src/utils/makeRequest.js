const axios = require("axios");
const { to } = require("await-to-js");
const https = require("https");

// Make external Api calls
const makeRequest = async (url, method, payload, headers = {}) => {
  headers["Content-Type"] = headers["Content-Type"]
    ? headers["Content-Type"]
    : "application/json";
  const payloadData =
    method == "GET"
      ? { method, headers }
      : { method, headers, body: JSON.stringify(payload) };
  const reqUrl = url;
  const resp = await fetch(reqUrl, { ...payloadData });
  const responseBody = await resp.json();
  if (resp.status !== 200) {
    return {
      success: false,
      message: "failed",
      data: responseBody,
      statusCode: resp.status,
      meta: resp,
    };
  }

  return {
    success: true,
    message: "success",
    data: responseBody,
    statusCode: resp.status,
  };
};

module.exports = {
  makeRequest,
};
