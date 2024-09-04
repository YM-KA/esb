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

const SibApiV3Sdk = require("sib-api-v3-sdk");
SibApiV3Sdk.ApiClient.instance.authentications["api-key"].apiKey =
  process.env.SENDINBLUE_API_KEY;

new SibApiV3Sdk.TransactionalEmailsApi()
  .sendTransacEmail({
    sender: { email: "sendinblue@sendinblue.com", name: "Sendinblue" },
    subject: "This is my default subject line",
    htmlContent:
      "<!DOCTYPE html><html><body><h1>My First Heading</h1><p>My first paragraph.</p></body></html>",
    params: {
      greeting: "This is the default greeting",
      headline: "This is the default headline",
    },
    messageVersions: [
      // Definition for Message Version 1
      {
        to: [
          {
            email: "bob@example.com",
            name: "Bob Anderson",
          },
          {
            email: "anne@example.com",
            name: "Anne Smith",
          },
        ],
        htmlContent:
          "<!DOCTYPE html><html><body><h1>Modified header!</h1><p>This is still a paragraph</p></body></html>",
        subject: "We are happy to be working with you",
      },

      // Definition for Message Version 2
      {
        to: [
          {
            email: "jim@example.com",
            name: "Jim Stevens",
          },
          {
            email: "mark@example.com",
            name: "Mark Payton",
          },
          {
            email: "andrea@example.com",
            name: "Andrea Wallace",
          },
        ],
      },
    ],
  })
  .then(
    (data) => {
      console.log(data);
    },
    (error) => {
      console.error(error);
    },
  );
