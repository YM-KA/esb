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

require("../firebase-db");
const { onRequest } = require("firebase-functions/v2/https");
const express = require("express");
// const cors = require("cors");

const { logger } = require("firebase-functions");

// const { validateToken } = require("./middleware");
const urlHelpers = require("./func-urlHelpers");
const ganttApi = require("./func-gantt");

const app = express();

// CORS SECURITY
// app.use(cors({ origin: true })); // Automatically allow cross-origin requests
const corsOpt = {
  origin: urlHelpers.getCorsDomains(),
  default: "https://api2.yoomi.se",
};

// API CORS Security
const setHeaderOrigin = (req, res, next) => {
  const debugMode = true;
  if (debugMode) {
    logger.info("corsOpt", JSON.stringify(corsOpt));
  }
  const org = req.header("origin") ? req.header("origin") : "";
  const originLowercase = org.toLowerCase();
  if (!org) {
    logger.warn("CORS origin not supplied");
  } else if (debugMode) {
    logger.info("CORS originLowercase", originLowercase);
    logger.info("CORS req.headers.origin", req.headers.origin);
  }

  const allowed = corsOpt.origin.indexOf(originLowercase) > -1 ? true : false;
  const origin = allowed ? req.headers.origin : corsOpt.default;

  if (debugMode) {
    logger.info("CORS check allowed", allowed);
    logger.info("CORS origin result", origin);
  }

  // Set headers - other CORS headers can be set here if needed
  res.header("Access-Control-Allow-Origin", origin);
  res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, authorization, client_id, client_secret, type, Accept",
  );
  res.header("Access-Control-Allow-Credentials", true);

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }
  next();
};

// Web client API calls CORS Security
app.all("/api2/v1/*", (req, res, next) => {
  setHeaderOrigin(req, res, next);
});

// Validate tokens AFTER cors check!
// app.use(validateToken);

/* LET THE API BEGIN! ---> */
ganttApi.whGanttJson({ app });

app.listen(443, () => logger.info("Yoomi API listening on port 443"));

// Expose API as a single Cloud Function
exports.api = onRequest(app);
