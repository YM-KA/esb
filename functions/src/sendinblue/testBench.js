/*
 * MIT License
 *
 * Copyright (c) 2024 Kazuyuki Arai, Yoomi AB
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

const database = require("../firebase-db");
const SibApiV3Sdk = require("sib-api-v3-sdk");
SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
  process.env.SENDINBLUE_API_KEY;

// GCP v2 logging
const { logger } = require("firebase-functions");

const levels = {
  LEVEL_ERROR: "LEVEL_ERROR",
  LEVEL_WARNING: "LEVEL_WARNING",
};

module.exports = {
  LEVEL_ERROR: levels.LEVEL_ERROR,
  LEVEL_WARNING: levels.LEVEL_WARNING,

  allowAlertEmailSend: async function () {
    const enableSendEmailSnap = await database
      .ref("/systemSettings/sendTransactionErrorEmail")
      .once("value");
    let enableSendEmail = false;
    if (enableSendEmailSnap.exists()) {
      enableSendEmail = enableSendEmailSnap.val();
    }
    return Promise.resolve(enableSendEmail);
  },
  sendAlertEmail: async function (
    { level, message, timeStamp } = {
      level: levels.LEVEL_ERROR,
      message: "",
      timeStamp: 0,
    },
  ) {
    const enableSendEmail = await this.allowAlertEmailSend();
    if (!enableSendEmail) {
      logger.info("sendAlertEmail - Sending of emails disabled. Exiting");
      return Promise.resolve();
    }

    const transactionEmailToSnap = await database
      .ref("/systemSettings/transactionEmailTo")
      .once("value");
    const to = [];
    if (transactionEmailToSnap.exists()) {
      transactionEmailToSnap.forEach((recipientSnap) => {
        const name = recipientSnap.key;
        const email = recipientSnap.val();
        to.push({ name, email });
      });
    }

    const transactionEmailCcSnap = await database
      .ref("/systemSettings/transactionEmailCc")
      .once("value");
    const cc = [];
    if (transactionEmailCcSnap.exists()) {
      transactionEmailCcSnap.forEach((ccSnap) => {
        const name = ccSnap.key;
        const email = ccSnap.val();
        cc.push({ name, email });
      });
    }

    if (to.length === 0) {
      logger.info("sendAlertEmail - No recipients. Exiting");
      return Promise.resolve();
    }

    let subject = "Warning: transaction anomaly";
    let h1 = "Yoomi API Proxy transaction warning.";
    switch (level) {
      case levels.LEVEL_ERROR:
        subject = "Alert: transaction error";
        h1 = "Yoomi API Proxy transaction error.";
        break;
      case levels.LEVEL_WARNING:
        subject = "Warning: transaction anomaly";
        h1 = "Yoomi API Proxy transaction warning.";
        break;
      default:
        subject = "Alert: transaction error";
        h1 = "Yoomi API Proxy transaction error.";
        break;
    }
    return new SibApiV3Sdk.TransactionalEmailsApi()
      .sendTransacEmail({
        subject: subject,
        sender: { email: "apiproxy@yoomi.se", name: "Yoomi API Proxy" },
        replyTo: { email: "kazuyuki@yoomi.se", name: "Kazuyuki Arai" },
        to: to,
        cc: cc,
        htmlContent: `<html>
        <body>
        <h1>${h1}</h1>
        <p>Message for transaction ${timeStamp}:</p>
        <p>${message}</p>
        </body>
        </html>`,
        params: { bodyMessage: `${h1} Message: ${message}` },
      })
      .then(
        (data) => {
          logger.debug(data);
          Promise.resolve();
        },
        (err) => {
          logger.error(err);
          Promise.resolve();
        },
      );
  },
};
