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
const { logger } = require("firebase-functions");

module.exports = {
  getCacheStrategy: async function () {
    const cacheStrategySnap = await database
      .ref("/esb/v1/cacheStrategy")
      .once("value");
    let cacheStrategy = {
      cacheEnabled: true,
      cacheFirstOnStale: true,
      cacheLifetimeSek: 3600,
    };
    if (cacheStrategySnap.exists()) {
      cacheStrategy = { ...cacheStrategySnap.val() };
    }
    return Promise.resolve(cacheStrategy);
  },

  enableDebugMode: async function () {
    const debugSnap = await database
      .ref("/systemSettings/enableDebugMode")
      .once("value");
    let debug = false;
    if (debugSnap.exists()) {
      debug = debugSnap.val();
    }
    return Promise.resolve(debug);
  },

  isClientAuthorised: async function ({
    clientId = null,
    clientSecret = null,
  }) {
    let clientAuthorised = false;
    const clientsSnap = await database.ref("/oauth2/clients").once("value");
    let clients = {};
    if (clientsSnap.exists()) {
      clients = { ...clients, ...clientsSnap.val() };
      for (const [client, credentials] of Object.entries(clients)) {
        logger.info("isClientAuthorised check client:", client);
        if (clientSecret) {
          if (
            credentials.client_id === clientId &&
            credentials.client_secret === clientSecret
          ) {
            clientAuthorised = true;
          }
        } else {
          if (credentials.client_id === clientId) {
            clientAuthorised = true;
          }
        }
      }
    }
    return Promise.resolve(clientAuthorised);
  },

  getClientName: async function ({ client_id = null }) {
    const clientsSnaps = await database
      .ref("oauth2/clients")
      .orderByChild("client_id")
      .equalTo(client_id)
      .once("value");
    let client = { name: "..." };
    if (clientsSnaps.exists()) {
      clientsSnaps.forEach((clientSnap) => {
        client = { ...client, ...clientSnap.val() };
      });
    }
    return Promise.resolve(client.name);
  },

  getClientApiKey: async function ({ clientId = null }) {
    const clientsSnaps = await database
      .ref("oauth2/clients")
      .orderByChild("client_id")
      .equalTo(clientId)
      .once("value");
    let client = { name: "..." };
    if (clientsSnaps.exists()) {
      clientsSnaps.forEach((clientSnap) => {
        client = { ...client, ...clientSnap.val() };
      });
    }
    const tokenObj = "token" in client ? client.token : {};
    const token = "token" in tokenObj ? tokenObj.token : null;
    return Promise.resolve(token);
  },

  getEndpointByName: async function ({ name = null, version = "v1" }) {
    const endpointsSnaps = await database
      .ref(`esb/${version}/endpoints`)
      .orderByChild("name")
      .equalTo(name)
      .once("value");
    let endpoint = { name: "...", host: "https://yoomi.se" };
    if (endpointsSnaps.exists()) {
      endpointsSnaps.forEach((clientSnap) => {
        endpoint = { ...endpoint, ...clientSnap.val() };
      });
    }
    return Promise.resolve(endpoint);
  },

  getTargetByKey: async function ({ key = null, version = "v1" }) {
    const targetSnap = await database
      .ref(`esb/${version}/targets/${key}`)
      .once("value");
    let target = "";
    if (targetSnap.exists()) {
      target = targetSnap.val();
    }
    return Promise.resolve(target);
  },

  getEsbVersion: async function () {
    const esbVersionSnap = await database
      .ref("/systemSettings/ESB_version")
      .once("value");
    const esbVersion = esbVersionSnap.exists() ? esbVersionSnap.val() : "v1";
    return Promise.resolve(esbVersion);
  },

  getEduAdminQueries: async function ({ esbVersion = "v1" }) {
    const defaultQueries = {
      events:
        "/v1/odata/Events?$expand=Personnel($select=Name,Primary,Priority,ConfirmationStatus),Sessions&$filter=OnDemand+eq+false+and+EndDate+gt+{{EndDate}}&$select=EventName,CourseName,CategoryId,CategoryName,ShowOnWeb,ShowOnWebInternal,StartDate,EndDate,MaxParticipantNumber,NumberOfBookedParticipants,ParticipantNumberLeft,StatusId,StatusText,CompanySpecific,ProjectNumber,BookingFormUrl",
      eventsEndDateMonthOffset: -6,
      programmestarts:
        "/v1/odata/ProgrammeStarts?$filter=EndDate+gt+{{EndDate}}&$select=ProgrammeName,CategoryId,CategoryName,ShowOnWeb,ProgrammeStartName,NumberOfBookedParticipants,ParticipantNumberLeft,StartDate,EndDate,ProjectNumber,BookingFormUrl",
      programmestartsEndDateOffset: -6,
      customers:
        "/v1/odata/Customers?$select=CustomerId,CustomerNumber,CustomerName,Address,City,Zip,Country",
    };
    const eduAdminQuerySnap = await database
      .ref(`/esb/${esbVersion}/queries`)
      .once("value");
    const eduAdminQueries = eduAdminQuerySnap.exists()
      ? eduAdminQuerySnap.val()
      : { ...defaultQueries };

    // Update events filter
    const currentDate = new Date();
    const adjustedDateEvent = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + eduAdminQueries.eventsEndDateMonthOffset,
      currentDate.getDate(),
    );
    const shortISODateEvent = adjustedDateEvent.toISOString().split("T")[0];
    eduAdminQueries.events = eduAdminQueries.events.replace(
      "{{EndDate}}",
      shortISODateEvent,
    );

    // Update programmestarts filter
    const adjustedDatePs = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + eduAdminQueries.programmestartsEndDateOffset,
      currentDate.getDate(),
    );
    const shortISODatePs = adjustedDatePs.toISOString().split("T")[0];
    eduAdminQueries.programmestarts = eduAdminQueries.programmestarts.replace(
      "{{EndDate}}",
      shortISODatePs,
    );

    return Promise.resolve(eduAdminQueries);
  },
};
