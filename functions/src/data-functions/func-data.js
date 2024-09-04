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
const funcEsb = require("../http-functions/func-esb");

const { logger } = require("firebase-functions");

module.exports = {
  getEduPersonId: function ({ respEdu }) {
    const pId = "PersonId" in respEdu ? respEdu.PersonId : "null";
    return pId;
  },

  getUpsalesId: function ({ respUpsales }) {
    const respData = "data" in respUpsales ? respUpsales.data : {};
    const respCustData = "custom" in respData ? respData.custom : [];
    const dstId = respCustData
      .filter((customObj) => customObj.fieldId === 4)
      .map((customObj) => customObj.value)[0];
    return dstId;
  },

  isUpsalesDuplicate: async function ({ respUpsales }) {
    const knownUpsalesDuplicatesSnap = await database
      .ref("/systemSettings/knownUpsalesDuplicates")
      .once("value");
    const knownDuplicateUpsalesIdsArray = knownUpsalesDuplicatesSnap.exists()
      ? knownUpsalesDuplicatesSnap.val()
      : [];
    const upsalesId = this.getUpsalesId({ respUpsales });
    const isKnownDuplicate = knownDuplicateUpsalesIdsArray.includes(upsalesId);
    return Promise.resolve(isKnownDuplicate);
  },

  isEmptyObject: function isEmpty(obj) {
    for (const prop in obj) {
      if (Object.hasOwn(obj, prop)) {
        return false;
      }
    }
    return true;
  },

  getFieldMap: async function ({ from = "", to = "", typeName = "Customer" }) {
    logger.info(`getFieldMap from '${from}' to '${to}' type: '${typeName}'`);
    const esbVersion = await funcEsb.getEsbVersion();

    const fieldMapSnap = await database
      .ref(`esb/${esbVersion}/fieldMap${typeName}/${from}/${to}`)
      .once("value");
    const fieldMap = fieldMapSnap.exists() ? fieldMapSnap.val() : {};

    return Promise.resolve(fieldMap);
  },

  getData: function ({
    fieldNameOnly = false,
    fullData = {},
    instruction = "|",
    type = "source",
  }) {
    const debug = false;
    const query =
      type === "source" ? instruction.split("|")[0] : instruction.split("|")[1];
    logger.info(
      `getData type:'${type}' fieldNameOnly: ${fieldNameOnly} query: '${query}'`,
    );
    const hasMatch = query.indexOf(".MATCH.") > -1 ? true : false;
    const hasStatic = query.indexOf(".STATIC.") > -1 ? true : false;

    let sourceData = "";
    let dataNode = fullData;

    // Perform matching for instructions with ".MATCH." in query --> data arrays
    if (hasMatch) {
      const basePath = query.split(".MATCH.")[0];
      if (debug) {
        logger.info("basePath", basePath);
      }
      // Get data in base path
      basePath.split(".").forEach((node) => {
        if (dataNode) {
          dataNode = node in dataNode ? dataNode[node] : null;
        }
      });

      if (dataNode) {
        // Find out what to match (fieldName, fieldValue) and key for value to retrieve
        const match = query.split(".MATCH.")[1].split(".")[0];
        if (debug) {
          logger.info("match", match);
        }
        const matchFieldName = match.split("=")[0];
        if (fieldNameOnly) {
          logger.info(`RETURN fieldNameOnly: '${matchFieldName}'`);
          return matchFieldName;
        }
        const matchFieldVal = match.split("=")[1];
        const retrieveKey = query.split(".MATCH.")[1].split(".")[1];

        // Iterate over array of data and look for fieldName === fieldValue
        for (const [key, value] of Object.entries(dataNode)) {
          if (debug) {
            logger.info(`look for ${matchFieldName}=${matchFieldVal}`);
            logger.info(`key: '${key}', value: '${JSON.stringify(value)}'`);
          }
          // Convert matchVal to String or Number
          const matchVal =
            matchFieldVal.charAt(0) === "'" &&
            matchFieldVal.charAt(matchFieldVal.length - 1) === "'"
              ? matchFieldVal.split("'")[1]
              : parseInt(matchFieldVal, 10);
          if (value[matchFieldName] === matchVal) {
            // We have a match - retrieve data from data node array object
            if (debug) {
              logger.info("match found!");
            }
            const index = parseInt(key, 10);
            sourceData = dataNode[index][retrieveKey];
            break;
          }
        }
      }
      logger.info(`RETURN from match '${sourceData}'`);
      return sourceData;
    }

    if (fieldNameOnly) {
      const fieldName = query;
      logger.info(`RETURN fieldNameOnly: '${fieldName}'`);
      return fieldName;
    }

    if (hasStatic) {
      let staticVal = query.split(".STATIC.")[1];
      staticVal = staticVal === "false" ? false : staticVal;
      staticVal = staticVal === "true" ? true : staticVal;
      logger.info(`RETURN STATIC: ${staticVal}`);
      return staticVal;
    }

    // Simple data retrieval with no data matching
    query.split(".").forEach((node) => {
      if (dataNode) {
        dataNode = dataNode[node];
      }
      if (debug) {
        logger.info("dataNode", dataNode);
      }
    });

    logger.info(`RETURN '${dataNode}'`);
    return dataNode;
  },

  getJsonDataFromText: function (text) {
    let data = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      logger.debug("getJsonDataFromText", e);
      logger.debug(`text:"${text}"`);
    }
    return data;
  },

  getSourceFieldName: function ({ fullData = {}, instruction = "||" }) {
    return this.getData({
      fieldNameOnly: true,
      fullData,
      instruction,
      type: "source",
    });
  },

  getSourceData: function ({ fullData = {}, instruction = "||" }) {
    return this.getData({ fullData, instruction, type: "source" });
  },

  getDestinationFieldName: function ({ fullData = {}, instruction = "||" }) {
    return this.getData({
      fieldNameOnly: true,
      fullData,
      instruction,
      type: "destination",
    });
  },

  getDestinationData: function ({ fullData = {}, instruction = "||" }) {
    return this.getData({ fullData, instruction, type: "destination" });
  },

  getAllDataTranslations: async function ({ typeName = "Customer" }) {
    const esbVersion = await funcEsb.getEsbVersion();

    const translationsSnap = await database
      .ref(`esb/${esbVersion}/fieldMap${typeName}/translations`)
      .once("value");
    const translations = translationsSnap.exists()
      ? translationsSnap.val()
      : {};

    return Promise.resolve(translations);
  },

  getDataTranslation: function ({
    data = "",
    instruction = "||",
    translationsDict = {},
  }) {
    const translationKey = instruction.split("|")[2];

    // Special case for OrganisationNumber
    if (translationKey === "OrganisationNumber") {
      if (data.length == 10) {
        const begin = data.slice(0, 6);
        const end = data.slice(6, 10);
        return `${begin}-${end}`;
      } else {
        return data;
      }
    }

    // No translation
    if (translationKey === "1") {
      return data;
    }

    logger.info(
      "getDataTranslation - Use translationsDict:",
      JSON.stringify(translationsDict),
    );
    const translation = translationsDict[translationKey][data];
    return translation;
  },

  setJsonValue: function (dest, keys, value) {
    if (!keys.length || keys.length === 0) {
      return;
    }

    const key = keys[0];
    const childKeys = keys.slice(1);

    // update - note: null is object
    if (dest[key] && typeof dest[key] === "object") {
      this.setJsonValue(dest[key], childKeys, value);
    } else {
      // insert
      if (childKeys.length === 0) {
        dest[key] = value;
      } else {
        // insert parent key & continue update
        dest[key] = {};
        this.setJsonValue(dest[key], childKeys, value);
      }
    }
  },

  // Add support for multiple instructions per field
  /*
    Can be  done by adding:
    _PRIO-01_orgNo : "data.custom.MATCH.fieldId=1.value|Customer.OrganisationNumber|OrganisationNumber"
    _PRIO-02_orgNo : "orgNo|Customer.OrganisationNumber|OrganisationNumber"
  */
  getWriteFieldData: async function ({
    destinationData = {},
    from = "upsales",
    sourceData = {},
    to = "fortnox",
    typeName = "Customer",
  }) {
    const fieldMap = await this.getFieldMap({ from, to, typeName });
    const translationsDict = await this.getAllDataTranslations({ typeName });

    logger.info(
      `getWriteFieldData typeName:"${typeName}" from:"${from}" to:"${to}"`,
    );
    logger.info("getWriteFieldData sourceData", JSON.stringify(sourceData));
    logger.info(
      "getWriteFieldData destinationData",
      JSON.stringify(destinationData),
    );

    let writeFieldData = {};
    let prioFieldData = {};
    for (const [key, instruction] of Object.entries(fieldMap)) {
      const keyType = key.substring(0, 6) === "_PRIO-" ? "prio" : "normal";
      logger.info("**Process", key);
      logger.info("key type", keyType);
      logger.info(`instruction:"${instruction}"`);

      const sourceFieldData = this.getSourceData({
        fullData: sourceData,
        instruction,
      }); // 'E-mail'
      const sourceDataTranslated = this.getDataTranslation({
        data: sourceFieldData,
        instruction,
        translationsDict,
      });
      const destinationFieldName = this.getDestinationFieldName({
        fullData: destinationData,
        instruction,
      }); // 'Customer.DefaultDeliveryTypes.Invoice'
      const destinationFieldData = this.getDestinationData({
        fullData: destinationData,
        instruction,
      }); // EMAIL

      const hasData = destinationFieldName && sourceFieldData ? true : false;
      const dataDiffers =
        destinationFieldData !== sourceDataTranslated ? true : false;
      const ignoreDataUpdate =
        sourceDataTranslated === "**NO_UPDATE**" ? true : false;
      logger.info(
        `sourceFieldData: '${sourceFieldData}' sourceDataTranslated: '${sourceDataTranslated}' destinationFieldName: '${destinationFieldName}'`,
      );
      logger.info(
        `hasData: '${hasData}' dataDiffers: '${dataDiffers}' ignoreDataUpdate: '${ignoreDataUpdate}'`,
      );
      if (hasData && dataDiffers & !ignoreDataUpdate) {
        const addData = destinationFieldName
          .split(".")
          .reverse()
          .reduce((res, key) => ({ [key]: res }), sourceDataTranslated);
        logger.info("addData", JSON.stringify(addData));
        if (keyType === "normal") {
          this.setJsonValue(
            writeFieldData,
            destinationFieldName.split("."),
            sourceDataTranslated,
          );
        }
        if (keyType === "prio") {
          const prioKey = key.split("_")[2];
          const prioOrder = key.substring(6, 8);
          prioFieldData[prioKey][prioOrder] = {
            destinationFieldName,
            sourceDataTranslated,
          };
        }
        logger.info("writeFieldData", JSON.stringify(writeFieldData));
      }
    }

    // Add prio data to writeFieldData
    /*
      prioFieldData = {
        orgNo : {
          01 : {destinationFieldName, sourceDataTranslated},
          02 : {destinationFieldName, sourceDataTranslated}
        }
      }
    */
    Object.entries(prioFieldData).forEach(([fieldKey, prioVal]) => {
      logger.info("process prio data key", fieldKey);
      let fieldKeyData = {};
      Object.entries(prioVal).forEach(([prioKey, destinationObj]) => {
        logger.info("prioKey", prioKey);
        fieldKeyData = {
          destinationFieldName: destinationObj.destinationFieldName,
          value: destinationObj.sourceDataTranslated,
        };
      });
      logger.info("prio field data", JSON.stringify(fieldKeyData));
      this.setJsonValue(
        writeFieldData,
        fieldKeyData.destinationFieldName.split("."),
        fieldKeyData.value,
      );
    });

    return writeFieldData;
  },

  demo: async function ({ sourceData = {}, destinationData = {} }) {
    const typeName = "Customer";
    const fieldMap = await this.getFieldMap({
      from: "upsales",
      to: "fortnox",
      typeName,
    });
    const translationsDict = await this.getAllDataTranslations({
      typeName: "Customer",
    });
    let writeFieldData = {};
    for (const [key, instruction] of Object.entries(fieldMap)) {
      logger.info("**Process", key);
      const sourceFieldData = this.getSourceData({
        fullData: sourceData,
        instruction,
      });
      const destinationFieldName = this.getDestinationFieldName({
        fullData: destinationData,
        instruction,
      });
      const destinationFieldData = this.getDestinationData({
        fullData: destinationData,
        instruction,
      });
      const destinationDataTranslated = this.getDataTranslation({
        data: destinationFieldData,
        instruction,
        translationsDict,
      });

      const hasData = destinationFieldName && sourceFieldData ? true : false;
      const dataDiffers =
        sourceFieldData !== destinationDataTranslated ? true : false;
      if (hasData && dataDiffers) {
        logger.info(
          `destinationFieldName: '${destinationFieldName}' sourceFieldData: '${sourceFieldData}' destinationDataTranslated: '${destinationDataTranslated}'`,
        );
        const addData = destinationFieldName
          .split(".")
          .reverse()
          .reduce((res, key) => ({ [key]: res }), sourceFieldData);
        logger.info("addData", JSON.stringify(addData));
        this.setJsonValue(
          writeFieldData,
          destinationFieldName.split("."),
          sourceFieldData,
        );
        logger.info("writeFieldData", JSON.stringify(writeFieldData));
      }
    }
    return writeFieldData;
  },
};
