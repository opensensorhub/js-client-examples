/***************************** BEGIN LICENSE BLOCK ***************************

 The contents of this file are subject to the Mozilla Public License, v. 2.0.
 If a copy of the MPL was not distributed with this file, You can obtain one
 at http://mozilla.org/MPL/2.0/.

 Software distributed under the License is distributed on an "AS IS" basis,
 WITHOUT WARRANTY OF ANY KIND, either express or implied. See the License
 for the specific language governing rights and limitations under the License.

 Copyright (C) 2015-2022 Georobotix Inc. All Rights Reserved.

 Author: Mathieu Dhainaut <mathieu.dhainaut@gmail.com>

 ******************************* END LICENSE BLOCK ***************************/

import SosGetResultContext from "./SosGetResult.context";
import HttpConnector from "../../../connector/HttpConnector";
import BinaryDataParser from "../../../parsers/BinaryDataParser";
import WebSocketFetchConnector from "../../../connector/WebSocketFetchConnector";

class SosGetResultReplayContext extends SosGetResultContext {

    /**
     * Builds the full url.
     * @protected
     * @param {Object} properties
     * @param {String} properties.service the service
     * @param {String} properties.offeringID the offeringID
     * @param {String} properties.observedProperty the observed property
     * @param {String} properties.startTime the start time (ISO format)
     * @param {String} properties.endTime the end time (ISO format)
     * @param {Number} properties.replaySpeed the replay factor
     * @param {Number} properties.responseFormat the response format (e.g video/mp4)
     * @param {Object} properties.customUrlParams - the encoding options
     * @return {String} the full url
     */
    getQueryString(properties) {
        let queryString     = super.getQueryString(properties);
        const startTime     = properties.startTime;
        const endTime       = properties.endTime;

        // adds temporalFilter
        queryString += "&temporalFilter=phenomenonTime," + startTime + "/" + endTime;

        // TODO: server issue, waiting for fix
        // queryString += "&responseFormat=application/octet-stream";

        return queryString;
    }

    async createDataConnector(properties) {
        const tls = (properties.tls) ? 's' : '';
        const url = properties.protocol + tls + '://' + properties.endpointUrl;

        // issue with SOS < 1.4, binary data cannot be fetch as HTTP in octet-stream, must use WebSocket as workaround
        await this.parser.checkInit();
        if(this.parser.parser instanceof BinaryDataParser) {
            return new WebSocketFetchConnector(url, properties);
        } else {
            //
            return new HttpConnector(url, {
                ...properties,
                method: 'GET'
            });
        }
    }

    async doTemporalRequest(properties, startTimestamp, endTimestamp,  status = {cancel:false}) {
        return new Promise(async (resolve, reject) => {
            try {
                const results = [];
                await this.parser.templatePromise;
                const data = await this.connector.doRequest('', this.getQueryString({
                        ...properties,
                        startTime: new Date(startTimestamp).toISOString(),
                        endTime: new Date(endTimestamp).toISOString()
                    }));
                if(status.cancel) {
                    reject();
                } else {
                    // this is because binary < 1.4 issue and the use of WS. In case in using WS, the data are provided in a array
                    if(Array.isArray(data)) {
                        for(let d of data) {
                            results.push(...await this.parseData(d));
                        }
                    } else {
                        results.push(...await this.parseData(data));
                    }
                    resolve(results);
                }
            } catch (ex) {
                reject(ex);
            }
        });
    }

    async parseData(messages) {
        return this.parser.parseDataBlock(messages);
    }

    isConnected() {
        return true;
    }

    async disconnect() {
    }
}

export default SosGetResultReplayContext;
