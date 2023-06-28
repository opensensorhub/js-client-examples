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

import {isDefined, randomUUID} from '../utils/Utils.js';
import {DATASOURCE_DATA_TOPIC} from "../Constants";
import DataSourceWorker from './worker/DataSource.worker';
import {Mode} from "./Mode";
import WorkerExt from "../worker/WorkerExt";

/**
 * The DataSource is the abstract class used to create different datasources.
 *
 */
// global worker
const maxPoolSize = 5;
const workersPool = [];
let currentInsertPoolIdx = 0;
let dataSourceWorkers={};

class DataSource {
    constructor(name, properties) {
        this.id = properties.id || "DataSource-" + randomUUID();
        this.name = name;
        this.properties = properties;
        this.eventSubscriptionMap = {};
        this.init = undefined;
        this.mode = Mode.REAL_TIME;

        if (isDefined(properties.mode)) {
            this.mode = properties.mode;
        }
    }

    /**
     * Gets the datasource id.
     * @return {String} the datasource id
     */
    getId() {
        return this.id;
    }

    /**
     * Gets the datasource name.
     * @return {String} the datasource name
     */
    getName() {
        return this.name;
    }

    terminate() {
        if (this.dataSourceWorker !== null) {
            this.dataSourceWorker.terminate();
        }
    }

    getTopicId() {
        return DATASOURCE_DATA_TOPIC + this.id;
    }

    subscribe(fn, eventTypes) {
        // associate function to eventType
        for (let i = 0; i < eventTypes.length; i++) {
            if (!(eventTypes[i] in this.eventSubscriptionMap)) {
                this.eventSubscriptionMap[eventTypes[i]] = [];
            }
            this.eventSubscriptionMap[eventTypes[i]].push(fn);
        }
    }

    //----------- ASYNCHRONOUS FUNCTIONS -----------------//
    async createWorker(properties) {
        return new WorkerExt(new DataSourceWorker());
    }

    /**
     * Update properties
     * @param {String} name - the datasource name
     * @param {Object} properties - the datasource properties
     * @param {Number} properties.bufferingTime - defines the time during the data has to be buffered
     * @param {Number} properties.timeOut - defines the limit time before data has to be skipped
     * @param {String} properties.protocol - defines the protocol of the datasource. @see {@link DataConnector}
     * @param {String} properties.endpointUrl the endpoint url
     * @param {String} properties.service the service
     * @param {Number} properties.responseFormat the response format (e.g video/mp4)
     * @param {Number} properties.reconnectTimeout - the timeout before reconnecting
     */
    async updateProperties(properties) {
        this.properties = {
            ...this.properties,
            ...properties
        };
        return this.dataSourceWorker.postMessageWithAck({
            message: 'update-properties',
            data: properties,
            dsId: this.id
        });
    }

    /**
     * Connect the dataSource then the protocol will be opened as well.
     */
    async connect() {
        await this.checkInit();
        return this.doConnect();
    }

    async getWorker() {
        if (!(this.id in dataSourceWorkers)) {
            // create new worker for this DS
            currentInsertPoolIdx = (currentInsertPoolIdx + 1) % maxPoolSize;
            if (!isDefined(workersPool[currentInsertPoolIdx])) {
                workersPool[currentInsertPoolIdx] = await this.createWorker();
            }
            dataSourceWorkers[this.id] = currentInsertPoolIdx;
        }
        // store worker idx into map for fast-mapping
        return workersPool[dataSourceWorkers[this.id]];
    }

    async initDataSource(properties = this.properties) {
        this.dataSourceWorker = await this.getWorker();
        return this.dataSourceWorker.postMessageWithAck({
            message: 'init',
            id: this.id,
            properties: properties,
            topics: {
                data: this.getTopicId()
            },
            dsId: this.id
        }).then(() => {
            // listen for Events to callback to subscriptions
            const datasourceBroadcastChannel = new BroadcastChannel(this.getTopicId());
            datasourceBroadcastChannel.onmessage = async (message) => {
                await this.handleMessage(message);
            };
            this.isInitialized = true;
        });
    }

    async handleMessage(message) {
        const type = message.data.type;
        if (type in this.eventSubscriptionMap) {
            for (let i = 0; i < this.eventSubscriptionMap[type].length; i++) {
                this.eventSubscriptionMap[type][i](message.data);
            }
        }
    }

    async checkInit() {
        if (!isDefined(this.init)) {
            this.init = this.initDataSource();
        }
        return this.init;
    }

    async doConnect() {
        return this.dataSourceWorker.postMessageWithAck({
            message: 'connect',
            dsId: this.id
        });
    }

    async isConnected() {
        if (!this.init) {
            return false;
        } else {
            await this.checkInit();
            return this.dataSourceWorker.postMessageWithAck({
                message: 'is-connected',
                dsId: this.id
            });
        }
    }

    /**
     * Disconnect the dataSource then the protocol will be closed as well.
     */
    async disconnect() {
        await this.checkInit();
        return this.dataSourceWorker.postMessageWithAck({
            message: 'disconnect',
            dsId: this.id
        });
    }

    async onDisconnect() {
    }

    reset() {
        this.init = undefined;
    }

    onRemovedDataSource(dataSourceId) {
    }

    onAddedDataSource(dataSourceId) {
    }

}

export default DataSource;
