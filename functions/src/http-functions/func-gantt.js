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
// const url = require("url");
// const firebaseFunctionsConfig = functions.config(); // Get config for different environments
// const dbRoot = database.ref();

const funcEsb = require("../http-functions/func-esb");
const funcFetch = require("../http-functions/func-fetch");
const funcOAuth = require("../http-functions/func-oauth");
const funcData = require("../data-functions/func-data");
const funcMiddleware = require("../http-functions/middleware");

const { logger } = require("firebase-functions");

// app.use(express.static("."));
// app.use(express.json());
// const funcEmailBuilder = require("../sendinblue/emailBuillder");

module.exports = {
  createAnyGanttObject: ({ event, counter, isChild, parentId, customers }) => {
    const courseCoordinator = event.Personnel.filter((cc) => cc.Primary);
    const jsonObject = {
      id: counter,
      name: event.CourseName,
      projectNumber: event.ProjectNumber,
      customerName:
        customers.find((c) => c.CustomerId === event.CustomerId)
          ?.CustomerName || "",
      periods: [
        {
          id: counter * 100000,
          projectId: event.ProjectNumber,
          start: new Date(event.StartDate).getTime(),
          end: new Date(event.EndDate).getTime(),
          courseCoordinator: courseCoordinator[0] || "",
          participantAmount: event.NumberOfBookedParticipants,
        },
      ],
      parent: isChild ? parentId : null,
    };
    return jsonObject;
  },

  sortJsonArray: function (jsonArray) {
    return jsonArray.sort((a, b) => {
      const startA = a.periods[0].start;
      const startB = b.periods[0].start;
      return startA - startB;
    });
  },

  createGanttJson: function ({
    programmeStarts = [],
    events = [],
    customers = [],
  }) {
    let parents = [];
    let counter = 1;

    programmeStarts.forEach((ps) => {
      parents.push({
        id: counter,
        name: ps.ProgrammeName,
        projectNumber: ps.ProjectNumber,
        periods: [
          {
            id: counter * 100000,
            projectId: ps.ProjectNumber,
            start: new Date(ps.StartDate).getTime(),
            end: new Date(ps.EndDate).getTime(),
            courseCoordinator: "N/A",
            participantAmount: ps.NumberOfBookedParticipants,
          },
        ],
      });
      counter++;
    });

    const psEvents = events.filter((event) => event.CategoryId === 56917);
    const simpleEvents = events.filter((event) => event.CategoryId !== 56917);

    let json = [];
    parents.forEach((ps) => {
      json.push(ps);
      const children = psEvents.filter(
        (event) => event.ProjectNumber == ps.projectNumber,
      );
      children.forEach((child) => {
        json.push(
          this.createAnyGanttObject({
            event: child,
            counter,
            isChild: true,
            parentId: ps.id,
            customers,
          }),
        );
        counter++;
      });
    });

    simpleEvents.forEach((event) => {
      json.push(
        this.createAnyGanttObject({
          event,
          counter,
          isChild: false,
          parentId: null,
          customers,
        }),
      );
      counter++;
    });

    return this.sortJsonArray(json);
  },

  getEduAdminData: async function ({
    systemAuthToken = "",
    endpointHost = "",
    query = "",
  }) {
    const url = `${endpointHost}${query}`;
    const options = {
      method: "GET",
      headers: {
        Authorization: `Bearer ${systemAuthToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
    };
    logger.debug("url:", url);
    logger.debug("options:", JSON.stringify(options));
    try {
      const res = await funcFetch.fetch(url, options);
      const text = await res.text();
      const eduAdminResponse = funcData.getJsonDataFromText(text);
      const status = res.status;
      logger.debug("res:", JSON.stringify(res));
      logger.debug("Request text response:", text);
      logger.debug("status:", JSON.stringify(status));
      if (status === 404) {
        logger.error("Status: 404");
        return Promise.resolve([]);
      }
      if (status !== 404 && status !== 200) {
        logger.error(`Status: ${status}`);
        return Promise.resolve([]);
      }

      const data = [...eduAdminResponse.value];
      return Promise.resolve(data);
    } catch (err) {
      logger.error("error:", err);
      return Promise.resolve([]);
    }
  },

  triggerCacheRebuild: async function (now = new Date().getTime()) {
    await database.ref("/cache/ganttJson/trigger").set(now);
  },

  whGanttJson: async function ({ app }) {
    app.get("/api2/v1/json/:token", async (req, res) => {
      const now = new Date().getTime();
      logger.info("/api2/v1/json/:token", now);
      logger.info("token", req.params.token);

      const apiToken = await funcMiddleware.getApiKey();
      if (req.params.token !== apiToken) {
        return res.status(401).json({ message: "Unauthorized" });
      }

      // Folow cache strategy
      const cacheStrategy = await funcEsb.getCacheStrategy();
      if (cacheStrategy.cacheEnabled) {
        const cacheTimeStampSnap = await database
          .ref("/cache/ganttJson/timeStamp")
          .once("value");
        const cacheTime = cacheTimeStampSnap.exists()
          ? cacheTimeStampSnap.val()
          : 0;
        const isStale = now - cacheTime > cacheStrategy.cacheLifetimeSek * 1000;
        const cacheGanttJsonSnap = await database
          .ref("/cache/ganttJson/data")
          .once("value");
        const cacheExists = cacheGanttJsonSnap.exists();

        if (isStale || !cacheExists) {
          await this.triggerCacheRebuild(now);
        }

        if (cacheExists) {
          if (!isStale || (isStale && cacheStrategy.cacheFirstOnStale)) {
            return res.status(200).send(cacheGanttJsonSnap.val());
          }
        }
      }

      const esbVersion = await funcEsb.getEsbVersion();
      const systemAuth = await funcOAuth.getAuthByName({ name: "eduAdmin" });
      const endpoint = await funcEsb.getEndpointByName({
        name: "eduAdmin",
        version: esbVersion,
      });
      const queries = await funcEsb.getEduAdminQueries({ esbVersion });

      // Get EduAdmin data
      const programmeStarts = await this.getEduAdminData({
        systemAuthToken: systemAuth.token,
        endpointHost: endpoint.host,
        query: queries.programmestarts,
      });
      const events = await this.getEduAdminData({
        systemAuthToken: systemAuth.token,
        endpointHost: endpoint.host,
        query: queries.events,
      });
      const customers = await this.getEduAdminData({
        systemAuthToken: systemAuth.token,
        endpointHost: endpoint.host,
        query: queries.customers,
      });

      // Create Gantt JSON
      const ganttJson = this.createGanttJson({
        programmeStarts,
        events,
        customers,
      });

      // Update cache
      await database.ref("/cache/ganttJson/timeStamp").set(now);
      await database.ref("/cache/ganttJson/data").set(ganttJson);

      // Return result
      return res.status(200).send(ganttJson);
    });
  },
};
