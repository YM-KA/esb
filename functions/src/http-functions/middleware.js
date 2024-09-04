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

// const database = require("../firebase-db");
const database = require("../firebase-db");
const { logger } = require("firebase-functions");

const getApiKey = async () => {
  // Fast config lookup
  const apiKey = process.env.ESB_API_KEY;
  if (apiKey) return apiKey;

  // Fallback to slow database lookup
  const apiTokenSnap = await database
    .ref("/systemSettings/apiKey")
    .once("value");
  let apiToken = "SECRET-STUFF-GOES-HERE";
  if (apiTokenSnap.exists()) {
    apiToken = apiTokenSnap.val();
  }
  return apiToken;
};

const validateToken = async (req, res, next) => {
  const authorizationHeader = req.headers["authorization"];
  // Check if Authorization header is provided
  if (!authorizationHeader) {
    logger.warn("Authorization header missing");
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Check if the Authorization header has the Bearer scheme
  const [scheme, token] = authorizationHeader.split(" ");
  if (scheme !== "Bearer" || !token) {
    logger.warn("Invalid token scheme or token missing");
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Get api key
  const apiToken = await getApiKey();

  // Check if the API token is valid (You can implement your own validation logic here)
  if (token !== apiToken) {
    logger.warn("Invalid token");
    return res.status(401).json({ message: "Unauthorized" });
  }
  // Token is valid, continue with the next middleware
  next();
};

module.exports = {
  validateToken: validateToken,
  getApiKey: getApiKey,
};
