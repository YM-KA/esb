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
const funcFetch = require("../http-functions/func-fetch");
const { logger } = require("firebase-functions");

// const urlHelpers = require("./func-urlHelpers");
// const appUrl = urlHelpers.getCorsDomains();
// app.use(express.static("."));
// app.use(express.json());

module.exports = {
  // Constants
  OAUTH_PENDING: "pending", // "authorization_pending",
  OAUTH_DONE: "done",
  TOKEN_EXPIRY_TIME: 1000 * 60 * 5, // 5 minutes
  CODE_EXPIRY_TIME: 1000 * 60 * 60, // 60 minutes

  isAcceptedRedirect: async function (uri) {
    const url = uri || "";
    const isSSL = url.startsWith("https://");
    // All accepted URIs MUST be HTTPS!
    if (!isSSL) {
      return false;
    }
    const oauthSnap = await database
      .ref("/oauth2/accepted_redirects")
      .once("value");
    let acceptedUris = [];
    if (oauthSnap.exists()) {
      acceptedUris = [...acceptedUris, ...oauthSnap.val()];
    }
    const accepted = acceptedUris.includes(url);
    return Promise.resolve(accepted);
  },

  getClient: async function ({ state = "" }) {
    const clientsSnaps = await database
      .ref("oauth2/clients")
      .orderByChild("state")
      .equalTo(state)
      .once("value");
    let client = {
      name: "...",
      client_id: "",
      client_secret: "",
      valid: false,
    };
    if (clientsSnaps.exists) {
      clientsSnaps.forEach((clientSnap) => {
        client = { ...client, valid: true, ...clientSnap.val() };
      });
    }
    return Promise.resolve(client);
  },

  generateCredentials: function ({ client }) {
    const clientId = client.client_id;
    const clientSecret = client.client_secret;
    const decodedString = `${clientId}:${clientSecret}`;
    const buff = Buffer.from(decodedString, "utf-8");
    return buff.toString("base64");
  },

  base64Encode: function (uncodedString) {
    const buff = Buffer.from(uncodedString, "utf-8");
    return buff.toString("base64");
  },

  base64Decode: function (decodedString) {
    const buff = Buffer.from(decodedString, "base64");
    return buff.toString("utf-8");
  },

  writeClientToken: async function ({
    clientName,
    expiresIn,
    now,
    refreshToken = null,
    scope = null,
    token,
    tokenType,
  }) {
    const expires = now + expiresIn;
    const updates = {
      [`oauth2/clients/${clientName}/token/expires`]: expires,
      [`oauth2/clients/${clientName}/token/lastUpdated`]: now,
      [`oauth2/clients/${clientName}/token/refreshToken`]: refreshToken,
      [`oauth2/clients/${clientName}/token/scope`]: scope,
      [`oauth2/clients/${clientName}/token/token`]: token,
      [`oauth2/clients/${clientName}/token/tokenType`]: tokenType,
    };
    await database.ref().update(updates);
  },

  getClientByName: async function ({ name = "" }) {
    const clientSnap = await database
      .ref(`oauth2/clients/${name}`)
      .once("value");
    let client = {
      name: "...",
      client_id: "",
      client_secret: "",
      password: "",
      userName: "",
      valid: false,
    };
    if (clientSnap.exists) {
      client = { ...client, valid: true, ...clientSnap.val() };
    }
    return Promise.resolve(client);
  },

  getClientTokenObj: function ({ client = {} }) {
    if ("token" in client) {
      return client.token;
    }
    return null;
  },

  getToken: function ({ tokenObj = {} }) {
    if ("token" in tokenObj) {
      return tokenObj.token;
    }
    return "";
  },

  hasTokenExpired: function ({ now = 1662564649482, token = {} }) {
    const expires = "expires" in token ? token.expires : 0;
    const hasExpired = now > expires;
    logger.info(`now > expires: ${now} > ${expires} --> ${hasExpired}`);
    return hasExpired;
  },

  getAuthUpsales: async function () {
    const now = new Date().getTime();
    logger.info("getAuthUpsales", now);
    const emptyResponseObj = { token: "", clientSecret: "" };
    const client = await this.getClientByName({ name: "upsales" });
    if (!client.valid) {
      logger.error("getAuthUpsales - Client not found!");
      return Promise.resolve(emptyResponseObj);
    }
    const tokenObj = this.getClientTokenObj({ client });
    if (!tokenObj) {
      logger.error("getAuthUpsales - Token missing for client", client.name);
      return Promise.resolve(emptyResponseObj);
    }
    const clientSecret = "client_secret" in client ? client.client_secret : "";

    logger.info("getAuthUpsales - Token still valid, exiting");
    const token = this.getToken({ tokenObj });
    return Promise.resolve({ token, clientSecret });
  },

  getAuthByName: async function ({ name = "" }) {
    const now = new Date().getTime();
    logger.info("getAuthByName", now);
    const emptyResponseObj = { token: "", clientSecret: "" };

    const client = await this.getClientByName({ name: name });
    if (!client.valid) {
      logger.error("getAuthByName - Client not found!");
      return Promise.resolve(emptyResponseObj);
    }

    const tokenObj = this.getClientTokenObj({ client });
    if (!tokenObj) {
      logger.error("getAuthByName - Token missing for client", client.name);
      return Promise.resolve(emptyResponseObj);
    }

    const clientSecret = "client_secret" in client ? client.client_secret : "";

    const expiredToken = this.hasTokenExpired({ now, token: tokenObj });
    if (!expiredToken) {
      logger.info("getAuthByName - Token still valid, exiting");
      const token = this.getToken({ tokenObj });
      return Promise.resolve({ token, clientSecret });
    }

    const userName = this.base64Decode(client.userName);
    const password = this.base64Decode(client.password);

    const body = `username=${userName}&password=${password}&grant_type=password`;
    const options = {
      method: "POST",
      headers: {
        "Content-type": "text/plain",
      },
      body: body,
      redirect: "follow",
    };

    const url = client.urlRefresh;
    try {
      const response = await funcFetch.fetch(url, options);
      logger.debug("res", JSON.stringify(response));
      const status = response.status;
      logger.debug("status", JSON.stringify(status));
      const text = await response.text();
      logger.info("Request text response", text);
      const json = JSON.parse(text);
      logger.info("json", JSON.stringify(json));
      if (status !== 200) {
        logger.warn("getAuthByName - Request response status", status);
        return Promise.resolve(emptyResponseObj);
      } else {
        /*
        {
          "token_type": "Bearer",
          "access_token": "",
          "expires_in": 86400,
          "userName": "your_user_name",
          ".issued": "Wed, 30 Sep 2020 11:57:49 GMT",
          ".expires": "Thu, 01 Oct 2020 11:57:49 GMT"
        }
        */
        const token = "access_token" in json ? json.access_token : "";
        const expires = "expires_in" in json ? json.expires_in : "";
        const expiresIn = expires === "" ? 0 : parseInt(expires, 10) * 1000;
        const tokenType = "token_type" in json ? json.token_type : "";
        const tokenData = {
          clientName: client.name,
          now,
          expiresIn,
          token,
          tokenType,
        };
        await this.writeClientToken(tokenData);
        logger.info("getAuthByName - Success");
        return Promise.resolve({ token, clientSecret });
      }
    } catch (err) {
      logger.error("getAuthByName - Error:", err);
      return Promise.resolve(emptyResponseObj);
    }
  },

  getAuthFortnox: async function ({ name = "" }) {
    const now = new Date().getTime();
    logger.info("getAuthFortnox", now);
    const emptyResponseObj = { token: "", clientSecret: "" };

    const client = await this.getClientByName({ name: name });
    if (!client.valid) {
      logger.error("getAuthFortnox - Client not found!");
      return Promise.resolve(emptyResponseObj);
    }

    const tokenObj = this.getClientTokenObj({ client });
    if (!tokenObj) {
      logger.error("getAuthFortnox - Token missing for client", client.name);
      return Promise.resolve(emptyResponseObj);
    }

    const clientSecret = "client_secret" in client ? client.client_secret : "";

    const expiredToken = this.hasTokenExpired({ now, token: tokenObj });
    if (!expiredToken) {
      logger.info("getAuthFortnox - Token still valid, exiting");
      const token = this.getToken({ tokenObj });
      return Promise.resolve({ token, clientSecret });
    }

    const credentials = this.generateCredentials({ client });
    const body = `grant_type=refresh_token&refresh_token=${tokenObj.refreshToken}`;
    const options = {
      method: "POST",
      headers: {
        "Content-type": "application/x-www-form-urlencoded",
        "Authorization": `Basic ${credentials}`,
      },
      body: body,
      redirect: "follow",
    };

    const url = client.urlRefresh;
    try {
      const response = await funcFetch.fetch(url, options);
      logger.debug("res", JSON.stringify(response));
      const status = response.status;
      logger.debug("status", JSON.stringify(status));
      const text = await response.text();
      logger.info("Request text response", text);
      const json = JSON.parse(text);
      logger.info("json", JSON.stringify(json));
      if (status !== 200) {
        logger.warn("getAuthFortnox - Request response status", status);
        return Promise.resolve(emptyResponseObj);
      } else {
        const token = "access_token" in json ? json.access_token : "";
        const refreshToken = "refresh_token" in json ? json.refresh_token : "";
        const scope = "scope" in json ? json.scope : "";
        const expires = "expires_in" in json ? json.expires_in : "";
        const expiresIn = expires === "" ? 0 : parseInt(expires, 10) * 1000;
        const tokenType = "token_type" in json ? json.token_type : "";
        const tokenData = {
          clientName: client.name,
          now,
          refreshToken,
          scope,
          expiresIn,
          token,
          tokenType,
        };
        await this.writeClientToken(tokenData);
        logger.debug("getAuthFortnox", JSON.stringify(tokenData));
        logger.info("getAuthFortnox - Success");
        return Promise.resolve({ token, clientSecret });
      }
    } catch (err) {
      logger.error("getAuthFortnox - Error:", err);
      return Promise.resolve(emptyResponseObj);
    }
  },

  /*
  (1) First step of oauth - Get Authorization-Code
  GET https://apps.fortnox.se/oauth-v1/auth?client_id=123
  &respone_type=code
  &state=secret
  &scope=companyinformation%20customer
  &access_type=offline
  &account_type=service
  &redirect_uri=https://api.yoomi.se/api/oauth2/activation

  (2) Response redirect https://api.yoomi.se/api/oauth2/activation?code={Authorization-Code}&state=somestate123

  (3) Exchange Authorization-Code for tokens
  POST https://apps.fortnox.se/oauth-v1/token
  Headers
  CREDENTIALS is the Base64 encoding of ClientId and Client-Secret, separated with a colon.
  Example:
  ClientId: SECRET
  ClientSecret: CLIENT_SECRET
  Credentials: OFZ1cnSECRETZUFJOnlGS3dtZThMRVE=

  $ echo -n "SECRET:CLIENT_SECRET" | base64

  Content-type: application/x-www-form-urlencoded
  Authorization: Basic {Credentials}

  Body
  grant_type=authorization_code&code={Authorization-Code}&redirect_uri=https://mysite.org/activation

  Response
  {
    "access_token": "xyz...",
    "refresh_token": "a7302e6b-b1cb-4508-b884-cf9abd9a51de",
    "scope": "companyinformation",
    "expires_in": 3600,
    "token_type": "Bearer"
  }

  (4) Refresh token
  POST https://apps.fortnox.se/oauth-v1/token
  Headers
  Content-type: application/x-www-form-urlencoded
  Authorization: Basic {Credentials}

  Body
  grant_type=refresh_token&refresh_token={Refresh-Token}
  */

  // (1) First step of oauth - Get Authorization-Code - call from API
  // (2) Redirect response - activation
  // (3) Exchange Authorization-Code for tokens
  activation: async function ({ app }) {
    app.get("/api/oauth2/activation", async (req, res) => {
      const now = new Date().getTime();
      const query = req.query;
      logger.info("/api/oauth2/activation", now);
      const debugMode = true;

      if (!query) {
        logger.info(
          "Incorrect call to /api/oauth2/activation - no query supplied",
        );
        return res.status(500).send("Something went wrong. code 0");
      }
      if (query.error) {
        logger.info(
          "Incorrect call to /api/oauth2/activation query",
          JSON.stringify(query),
        );
        return res.status(500).send("Something went wrong. code 1");
      }
      if (query) {
        logger.info("Correct call to /api/oauth2/activation");
        if (debugMode) {
          logger.debug("/api/oauth2/activation query", JSON.stringify(query));
        }
        let code;
        let state;
        ({ code = null, state = null } = query);

        const client = await this.getClient({ state });
        if (!client.valid) {
          return res.status(403).send("Unauthorised");
        }

        if (debugMode) {
          logger.debug("/api/oauth2/activation client", JSON.stringify(client));
        }

        const credentials = this.generateCredentials({ client });
        const body = `grant_type=authorization_code&code=${code}&redirect_uri=https://api.yoomi.se/api/oauth2/activation`;

        const options = {
          method: "POST",
          headers: {
            "Content-type": "application/x-www-form-urlencoded",
            "Authorization": `Basic ${credentials}`,
          },
          body: body,
          redirect: "follow",
        };

        const url = client.urlToken;
        try {
          const response = await funcFetch.fetch(url, options);
          logger.debug("res", JSON.stringify(response));
          const status = response.status;
          logger.debug("status", JSON.stringify(status));
          const text = await response.text();
          logger.info("Request text response", text);
          const json = JSON.parse(text);
          logger.info("json", JSON.stringify(json));
          if (status !== 200) {
            logger.warn("Request response status", status);
            return res.status(200).send("Something went wrong. code 2");
          } else {
            const token = "access_token" in json ? json.access_token : "";
            const refreshToken =
              "refresh_token" in json ? json.refresh_token : "";
            const scope = "scope" in json ? json.scope : "";
            const expires = "expires_in" in json ? json.expires_in : "";
            const expiresIn = expires === "" ? 0 : parseInt(expires, 10) * 1000;
            const tokenType = "token_type" in json ? json.token_type : "";
            const tokenData = {
              clientName: client.name,
              now,
              refreshToken,
              scope,
              expiresIn,
              token,
              tokenType,
            };
            if (debugMode) {
              logger.debug(
                "/api/oauth2/activation tokenData",
                JSON.stringify(tokenData),
              );
            }
            await this.writeClientToken(tokenData);
            return res.redirect(301, "/oa2ok.html");
          }
        } catch (err) {
          logger.error("error:", err);
          return res.status(500).send("Something went wrong. code 3");
        }
      }

      // Fallback default
      logger.info("/api/oauth2/activation Fallback");
      return res.status(500).send(">> No response");
    });
  },
};
