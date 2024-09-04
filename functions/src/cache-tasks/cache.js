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

const { onValueUpdated } = require("firebase-functions/v2/database");
const database = require("../firebase-db");

const funcEsb = require("../http-functions/func-esb");
const funcOAuth = require("../http-functions/func-oauth");
const funcGantt = require("../http-functions/func-gantt");

const { logger } = require("firebase-functions");

exports.triggerCacheRebuild = onValueUpdated(
  {
    ref: "/cache/ganttJson/trigger",
    // instance: "default",
    region: "europe-west1",
  },
  async (event) => {
    const data = event.data.after.val();
    logger.info("triggerCacheRebuild", data);
    const now = new Date().getTime();

    const esbVersion = await funcEsb.getEsbVersion();
    const systemAuth = await funcOAuth.getAuthByName({ name: "eduAdmin" });
    const endpoint = await funcEsb.getEndpointByName({
      name: "eduAdmin",
      version: esbVersion,
    });
    const queries = await funcEsb.getEduAdminQueries({ esbVersion });

    // Get EduAdmin data
    const programmeStarts = await funcGantt.getEduAdminData({
      systemAuthToken: systemAuth.token,
      endpointHost: endpoint.host,
      query: queries.programmestarts,
    });
    const events = await funcGantt.getEduAdminData({
      systemAuthToken: systemAuth.token,
      endpointHost: endpoint.host,
      query: queries.events,
    });
    const customers = await funcGantt.getEduAdminData({
      systemAuthToken: systemAuth.token,
      endpointHost: endpoint.host,
      query: queries.customers,
    });

    // Create Gantt JSON
    const ganttJson = funcGantt.createGanttJson({
      programmeStarts,
      events,
      customers,
    });

    // Update cache
    await database.ref("/cache/ganttJson/timeStamp").set(now);
    await database.ref("/cache/ganttJson/data").set(ganttJson);

    return Promise.resolve();
  },
);
